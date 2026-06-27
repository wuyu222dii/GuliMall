package com.atguigu.gulimall.product.service.impl;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.TypeReference;
import com.atguigu.gulimall.product.service.CategoryBrandRelationService;
import com.atguigu.gulimall.product.vo.Catelog2Vo;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.Query;

import com.atguigu.gulimall.product.dao.CategoryDao;
import com.atguigu.gulimall.product.entity.CategoryEntity;
import com.atguigu.gulimall.product.service.CategoryService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;


@Service("categoryService")
public class CategoryServiceImpl extends ServiceImpl<CategoryDao, CategoryEntity> implements CategoryService {

//    private Map<String, Object> cache = new HashMap<>();

    @Autowired
    CategoryBrandRelationService categoryBrandRelationService;

    @Autowired
    StringRedisTemplate redisTemplate;

    @Autowired
    RedissonClient redisson;

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        IPage<CategoryEntity> page = this.page(
                new Query<CategoryEntity>().getPage(params),
                new QueryWrapper<CategoryEntity>()
        );
        return new PageUtils(page);
    }

    @Override
    public List<CategoryEntity> listWithTree() {
        // 1 Find all categories
        List<CategoryEntity> categoryEntityList = baseMapper.selectList(null);
        // 2 Assembled into a parent-child tree structure
        // 2.1Find all first level categories
        List<CategoryEntity> level1Menus = categoryEntityList.stream().filter(e -> e.getParentCid() == 0)
                .map((menu) -> {
                    // 2.2 find submenu
                    menu.setChildren(getChildren(menu, categoryEntityList));
                    return menu;
                })
                .sorted(Comparator.comparingInt(menu -> (menu.getSort() == null ? 0 : menu.getSort())))
                /*.sorted((menu1,menu2)->{
                    return (menu1.getSort()==null?0: menu1.getSort())-(menu2.getSort()==null?0: menu2.getSort());
                })*/
                //.sorted(Comparator.comparingInt(menu -> (menu.getSort() == null ? 0 : menu.getSort())))
                .collect(Collectors.toList());

        return level1Menus;
    }

    private List<CategoryEntity> getChildren(CategoryEntity root, List<CategoryEntity> categoryEntityList) {
        return categoryEntityList.stream()
                .filter(e -> Objects.equals(e.getParentCid(), root.getCatId()))
                .map((entity) -> {
                    entity.setChildren(getChildren(entity, categoryEntityList));
                    return entity;
                })
                .sorted(Comparator.comparingInt(menu -> (menu.getSort() == null ? 0 : menu.getSort())))
                .collect(Collectors.toList());
    }

    @Override
    public Long[] findCatelogPath(Long catelogId) {
        List<Long> paths = new ArrayList<>();
        List<Long> parentPath = findParentPath(catelogId, paths);
        Collections.reverse(parentPath);
        return (Long[]) parentPath.toArray(new Long[parentPath.size()]);
    }

    private List<Long> findParentPath(Long catelogId, List<Long> paths) {
        paths.add(catelogId);
        CategoryEntity byId = this.getById(catelogId);
        if (byId.getParentCid() != 0) {
            findParentPath(byId.getParentCid(), paths);
        }
        return paths;
    }

    //Cascade update of all associated data (You need to start a transaction, inMyBatisConfigmiddle@EnableTransactionManagement)
    /**
     * 1, perform multiple cache operations at the same time @Caching
     * 2, specify to delete all data under a certain partition @CacheEvict(value = "category", allEntries = true)
     * 3, to store data of the same type, can be designated as the same partition. The partition name defaults to the cached name.
     *
     * @param category
     */
//    @Caching(evict = {
//            @CacheEvict(value = "category", key = "'getLevel1Categorys'"),
//            @CacheEvict(value = "category", key = "'getCatalogJson'")
//    })
    // category:key
    @CacheEvict(value = "category", allEntries = true)
    @CachePut // Dual write mode
    @Transactional
    @Override
    public void updateCascade(CategoryEntity category) {
        this.updateById(category);
        categoryBrandRelationService.updateCategory(category.getCatId(), category.getName());

        // Also update data in cache
        // redis.del("catalogJSON");Waiting for the next active query to update
    }

    // Rendering a first-level category menu

    /**
     * 1. For each data that needs to be cached, we must specify the cache of that name [cache partition (according to business type)]
     * 2, @Cacheable({"category"})
     * Indicates that the result of the current method needs to be cached. If it exists in the cache, the method does not need to be called.
     * If it is not in the cache, the method will be called and the result of the method will be put into the cache.
     * 3, default behavior
     * 1), if it exists in the cache, the method does not need to be called.
     * 2),keyAutomatically generated by default: Cache name::SimpleKey [](Automatically generatedkeyvalue)
     * 3), cachedvaluevalue, used by defaultjdkSerialization mechanism, save the serialized data toredis
     * 4),defaultttltime is-1
     * <p>
     * <p>
     * Customize:
     * 1), specify the generated cache to usekey:keyAttribute specified, receives aspEL
     * SpELdetailed:
     * 2), specify the survival time of cached data: Modify in configuration filettl
     * 3), save the data asjsonFormat:
     *      CustomizeRedisCacheConfigurationThat’s it
     * 4,Spring-CacheDisadvantages:
     *        1), read mode:
     *        Cache penetration: query anulldata. Solution: cachenulldata--》 spring.cache.redis.cache-null-values=true
     *        Cache breakdown: A large number of concurrent queries come in and query data that happens to be expired. Solution: Lock:? The default is no locking;sync=true(Lock to resolve breakdown)
     *        Cache avalanche: a lotkeyExpires at the same time. Solution: Add random time. Add expiration time. :spring.cache.redis.time-to-live=3600000
     *        2), write mode (the cache is consistent with the database)
     *            1), read-write lock
     *            2), introductionCanal, perceivedMysqlUpdate to update the database
     *            3), read more and write more, just go to the database to query
     *   Summarize:
     *      Regular data (read more, write less, immediacy, data with low consistency requirements); can be used completelySpring-Cache: Write mode (as long as the cached data has an expiration time, it is enough)
     *
     *      Special Data: Special Design
     *
     *   principle:
     *      CacheManager(RedisCacheManager)->Cache(RedisCache)->CacheResponsible for cache reading and writing
     *
     *
     *
     * @return
     */
    @Cacheable(value = {"category"}, key = "#root.method.name",sync = true)
    // It means that the result of the current method needs to be cached. If there is it in the cache, the method does not need to be called. If it is not in the cache, the method will be called and the result of the method will be placed in the cache.
    @Override
    public List<CategoryEntity> getLevel1Categorys() {
        System.out.println("getLevel1Categorys......");
        List<CategoryEntity> categoryEntities = baseMapper.selectList(new QueryWrapper<CategoryEntity>().eq("parent_cid", 0));
        return categoryEntities;
    }

    @Cacheable(value = "category", key = "#root.methodName")
    @Override
    public Map<String, List<Catelog2Vo>> getCatalogJson() {
        System.out.println("The database was queried. . .");
        List<CategoryEntity> selectList = baseMapper.selectList(null);
        List<CategoryEntity> level1Category = getParent_cid(selectList, 0L);
        //2, encapsulated data
        Map<String, List<Catelog2Vo>> parent_cid = level1Category.stream().collect(Collectors.toMap(k -> k.getCatId().toString(), v -> {
            //1, the first-level classification of each, find the second-level classification of this first-level classification
            List<CategoryEntity> level2Category = getParent_cid(selectList, v.getCatId());
            List<Catelog2Vo> catelog2Vos = null;
            if (!CollectionUtils.isEmpty(level2Category)) {
                //1, find the third-level classification package of the current second-level classificationvo
                catelog2Vos = level2Category.stream().map(l2 -> {
                    Catelog2Vo catelog2Vo = new Catelog2Vo(v.getCatId().toString(), l2.getCatId().toString(), l2.getName(), null);
                    List<CategoryEntity> level3Category = getParent_cid(selectList, l2.getCatId());
                    List<Catelog2Vo.Catalog3Vo> catalog3VoList = level3Category.stream().map(l3 -> {
                        Catelog2Vo.Catalog3Vo catalog3Vo = new Catelog2Vo.Catalog3Vo(l2.getCatId().toString(), l3.getCatId().toString(), l3.getName().toString());
                        return catalog3Vo;
                    }).collect(Collectors.toList());
                    catelog2Vo.setCatalog3List(catalog3VoList);
                    return catelog2Vo;
                }).collect(Collectors.toList());
            }
            return catelog2Vos;
        }));
        return parent_cid;
    }

    // todo An off-heap memory overflow occurs:OutOfDirectMemoryError
    // 1),springboot2.0Use by default from now onlettuceas operationredisclient. he usesnettyCarry out network communication.
    // 2),lettuceofbuglead tonettyOff-heap memory overflow
    // can pass-Dio.netty.maxDirectMemoryMake settings
    // Solution: Cannot be used-Dio.netty.maxDirectMemoryOnly adjust large off-heap memory.
    // 1,upgradelettuceclient    2, switch to usejedis
    // redisTemplate:
    // lettuce,jedisoperateredisThe underlying client,SpringEncapsulate againredisTemplate
    // Rendering secondary and tertiary classification data
//    @Override
    public Map<String, List<Catelog2Vo>> getCatalogJson2() {
        // put in cachejsonString, taken outjsonStrings are also reversed into usable object types: [Serialization and Deserialization]

        /**
         * 1, Empty result cache: solving cache penetration
         * 2, Set expiration time (add random value): solve cache avalanche
         * 3, Locking: Solving cache breakdown
         */
        // 1, add cache logic, the data stored in the cache isjsonstring
        // JSONIt is cross-language and cross-platform compatible
        String catalogJSON = redisTemplate.opsForValue().get("catalogJSON");
        if (StringUtils.isEmpty(catalogJSON)) {
            // 2, not in the cache, query the database
            // Ensure that after the database query is completed, the data is placed inredis, this is an atomic operation
            System.out.println("Cache miss. . . Query the database. . .");
            Map<String, List<Catelog2Vo>> catalogJsonFromDb = getCatalogJsonFromDbWithRedisLock();
            return catalogJsonFromDb;
        }

        System.out.println("Cache hit. . . Return directly. .");
        // Convert to the object we specify
        Map<String, List<Catelog2Vo>> result = JSON.parseObject(catalogJSON, new TypeReference<Map<String, List<Catelog2Vo>>>() {
        });

        return result;
    }

    /**
     * How to keep the data in the cache consistent with the database
     * Cache data consistency
     * 1), double write mode
     * 2), failure mode
     *
     * @return
     */

    public Map<String, List<Catelog2Vo>> getCatalogJsonFromDbWithRedissonLock() {

        // 1, the name of the lock, the granularity of the lock, the finer the faster
        //Lock granularity: specific data is cached.11-Product No.:product-11-lock product-12-lock  product-lock
        RLock lock = redisson.getLock("catalogJson-lock");
        lock.lock();


        Map<String, List<Catelog2Vo>> dataFromDb;
        try {
            dataFromDb = getDataFromDb();
        } finally {
            lock.unlock();
        }
        return dataFromDb;

    }

    public Map<String, List<Catelog2Vo>> getCatalogJsonFromDbWithRedisLock() {

        // 1, occupying distributed locks. goredisOccupy a pit
        String uuid = UUID.randomUUID().toString();
        Boolean lock = redisTemplate.opsForValue().setIfAbsent("lock", uuid, 300, TimeUnit.SECONDS);
        if (lock) {
            System.out.println("Obtaining distributed lock successfully. . .");
            // Locked successfully...Execute business
            // 2, set expiration time,Must be synchronized with locking, atomic
//            redisTemplate.expire("lock", 30, TimeUnit.SECONDS);
            Map<String, List<Catelog2Vo>> dataFromDb;
            try {
                dataFromDb = getDataFromDb();
            } finally {
                String script = "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
                // delete lock
                Long lock1 = redisTemplate.execute(new DefaultRedisScript<Long>(script, Long.class), Arrays.asList("lock"), uuid);
            }

            //Get value comparison+Contrast success=Atomic operations    luascript unlock
//            String lockValue = redisTemplate.opsForValue().get("lock");
//            if (uuid.equals(lockValue)) {
//                // Delete own lock
//                redisTemplate.delete("lock");// delete lock
//            }
            return dataFromDb;
        } else {
            // Lock failed. . . . Try again.synchronized()
            // hibernate100msTry again
            System.out.println("Failed to acquire distributed lock. . . Waiting for retry");
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            return getCatalogJsonFromDbWithRedisLock(); // Spin mode
        }

    }

    private Map<String, List<Catelog2Vo>> getDataFromDb() {
        String catalogJSON = redisTemplate.opsForValue().get("catalogJSON");
        if (StringUtils.isEmpty(catalogJSON)) {
            // Caching is notnullReturn directly
            Map<String, List<Catelog2Vo>> result = JSON.parseObject(catalogJSON, new TypeReference<Map<String, List<Catelog2Vo>>>() {
            });

            return result;
        }
        System.out.println("Database queried");

        List<CategoryEntity> selectList = baseMapper.selectList(null);

        List<CategoryEntity> level1Category = getParent_cid(selectList, 0L);
        //2, encapsulated data
        Map<String, List<Catelog2Vo>> parent_cid = level1Category.stream().collect(Collectors.toMap(k -> k.getCatId().toString(), v -> {
            //1, the first-level classification of each, find the second-level classification of this first-level classification
            List<CategoryEntity> level2Category = getParent_cid(selectList, v.getCatId());
            List<Catelog2Vo> catelog2Vos = null;
            if (!CollectionUtils.isEmpty(level2Category)) {
                //1, find the third-level classification package of the current second-level classificationvo
                catelog2Vos = level2Category.stream().map(l2 -> {
                    Catelog2Vo catelog2Vo = new Catelog2Vo(v.getCatId().toString(), l2.getCatId().toString(), l2.getName(), null);
                    List<CategoryEntity> level3Category = getParent_cid(selectList, l2.getCatId());
                    List<Catelog2Vo.Catalog3Vo> catalog3VoList = level3Category.stream().map(l3 -> {
                        Catelog2Vo.Catalog3Vo catalog3Vo = new Catelog2Vo.Catalog3Vo(l2.getCatId().toString(), l3.getCatId().toString(), l3.getName().toString());
                        return catalog3Vo;
                    }).collect(Collectors.toList());
                    catelog2Vo.setCatalog3List(catalog3VoList);
                    return catelog2Vo;
                }).collect(Collectors.toList());
            }
            return catelog2Vos;
        }));

        // 3, the found data is then put into the cache,Convert object tojsonput in cache
        String s = JSON.toJSONString(parent_cid);
        redisTemplate.opsForValue().set("catalogJSON", s, 1, TimeUnit.DAYS);
        return parent_cid;
    }

    // Query and encapsulate classified data from the database
    public Map<String, List<Catelog2Vo>> getCatalogJsonFromDbWithLocalLock() {

//        // 1. If it exists in the cache, use the cached one.
//        Map<String, List<Catelog2Vo>> catalogJson = (Map<String, List<Catelog2Vo>>) cache.get("catalogJson");
//        if (cache.get("catalogJson") == null) {
//            // Call business
//            // Return data into cache
//
//            cache.put("catalogJson", parent_cid);
//        }
//
//        return catalogJson;

        // As long as it is the same lock, all threads of this lock can be locked.
        //1,synchronized (this):SpringBootAll components are singletons in the container.
        // todo Local lock:synchronized,JUC(lock), in a distributed situation, if you want to lock everything, you must use a distributed lock

        synchronized (this) {
            // After getting the lock, we should check it in the cache again. If not, we need to continue querying.
            return getDataFromDb();
        }


    }

    private List<CategoryEntity> getParent_cid(List<CategoryEntity> selectList, Long parent_cid) {
        List<CategoryEntity> collect = selectList.stream().filter(item -> item.getParentCid() == parent_cid).collect(Collectors.toList());
        // return baseMapper.selectList(new QueryWrapper<CategoryEntity>().eq("parent_cid", v.getCatId()));
        return collect;
    }

    @Override
    public void removeMenuByIds(List<Long> asList) {

    }

}
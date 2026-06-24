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
        // 1 查出所有分类
        List<CategoryEntity> categoryEntityList = baseMapper.selectList(null);
        // 2 组装成父子的树形结构
        // 2.1找到所有一级分类
        List<CategoryEntity> level1Menus = categoryEntityList.stream().filter(e -> e.getParentCid() == 0)
                .map((menu) -> {
                    // 2.2 找出子菜单
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

    //级联更新所有关联数据 (需要开启事务，在MyBatisConfig中@EnableTransactionManagement)
    /**
     * 1、同时进行多种缓存操作 @Caching
     * 2、指定删除某个分区下的所有数据 @CacheEvict(value = "category", allEntries = true)
     * 3、存储同一类型的数据，都可以指定成同一个分区。分区名默认就是缓存的名字
     *
     * @param category
     */
//    @Caching(evict = {
//            @CacheEvict(value = "category", key = "'getLevel1Categorys'"),
//            @CacheEvict(value = "category", key = "'getCatalogJson'")
//    })
    // category:key
    @CacheEvict(value = "category", allEntries = true)
    @CachePut // 双写模式
    @Transactional
    @Override
    public void updateCascade(CategoryEntity category) {
        this.updateById(category);
        categoryBrandRelationService.updateCategory(category.getCatId(), category.getName());

        // 同时更新缓存中的数据
        // redis.del("catalogJSON");等待下次主动查询进行更新
    }

    // 渲染一级分类菜单

    /**
     * 1、 每一个需要缓存的数据我们都来指定要放到那个名字的缓存【缓存的分区（按照业务类型分）】
     * 2、 @Cacheable({"category"})
     * 代表当前方法的结果需要缓存，如果缓存中有，方法不用调用
     * 如果缓存中没有，会调用方法，最后将方法的结果放入到缓存
     * 3、默认行为
     * 1）、如果缓存中有，方法不用调用。
     * 2）、key默认自动生成：缓存的名字：：SimpleKey []（自动生成key的值）
     * 3）、缓存的value的值，默认使用jdk序列化机制，将序列化后的数据存到redis
     * 4）、默认ttl时间是-1
     * <p>
     * <p>
     * 自定义：
     * 1）、指定生成的缓存使用的key：key属性指定，接收一个spEL
     * SpEL详细：
     * 2）、指定缓存的数据的存活时间: 配置文件中修改ttl
     * 3）、将数据保存为json格式：
     *      自定义RedisCacheConfiguration即可
     * 4、Spring-Cache的不足之处：
     *        1）、读模式：
     *        缓存穿透：查询一个null数据。解决：缓存null数据--》 spring.cache.redis.cache-null-values=true
     *        缓存击穿：大量并发进来同时查询一个正好过期的数据。解决：加锁：？默认是无加锁的；sync=true(加锁，解决击穿)
     *        缓存雪崩：大量的key同时过期。解决：加随机时间。加上过期时间。：spring.cache.redis.time-to-live=3600000
     *        2）、写模式（缓存与数据库一致）
     *            1）、读写加锁
     *            2）、引入Canal，感知到Mysql的更新去更新数据库
     *            3）、读多写多，直接去数据库查询就行
     *   总结：
     *      常规数据（读多写少，即时性，一致性要求不高的数据）；完全可以使用Spring-Cache：写模式（只要缓存的数据有过期时间就足够了）
     *
     *      特殊数据：特殊设计
     *
     *   原理：
     *      CacheManager(RedisCacheManager)->Cache(RedisCache)->Cache负责缓存的读写
     *
     *
     *
     * @return
     */
    @Cacheable(value = {"category"}, key = "#root.method.name",sync = true)
    // 代表当前方法的结果需要缓存，如果缓存中有，方法不用调用。如果缓存中没有就会调用方法，将方法的结果放入缓存
    @Override
    public List<CategoryEntity> getLevel1Categorys() {
        System.out.println("getLevel1Categorys......");
        List<CategoryEntity> categoryEntities = baseMapper.selectList(new QueryWrapper<CategoryEntity>().eq("parent_cid", 0));
        return categoryEntities;
    }

    @Cacheable(value = "category", key = "#root.methodName")
    @Override
    public Map<String, List<Catelog2Vo>> getCatalogJson() {
        System.out.println("查询了数据库。。。");
        List<CategoryEntity> selectList = baseMapper.selectList(null);
        List<CategoryEntity> level1Category = getParent_cid(selectList, 0L);
        //2、封装数据
        Map<String, List<Catelog2Vo>> parent_cid = level1Category.stream().collect(Collectors.toMap(k -> k.getCatId().toString(), v -> {
            //1、每一个的一级分类，查到这个一级分类的二级分类
            List<CategoryEntity> level2Category = getParent_cid(selectList, v.getCatId());
            List<Catelog2Vo> catelog2Vos = null;
            if (!CollectionUtils.isEmpty(level2Category)) {
                //1、找当前二级分类的三级分类封装vo
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

    // todo 产生堆外内存溢出：OutOfDirectMemoryError
    // 1)、springboot2.0以后默认使用lettuce作为操作redis的客户端。他使用netty进行网络通信。
    // 2）、lettuce的bug导致netty堆外内存溢出
    // 可以通过-Dio.netty.maxDirectMemory进行设置
    // 解决方案：不能使用-Dio.netty.maxDirectMemory只去调大堆外内存。
    // 1、升级lettuce客户端    2、 切换使用jedis
    // redisTemplate:
    // lettuce、jedis操作redis的底层客户端，Spring再次封装redisTemplate
    // 渲染二级三级分类数据
//    @Override
    public Map<String, List<Catelog2Vo>> getCatalogJson2() {
        // 给缓存中放json字符串，拿出的json字符串，还用逆转为能用的对象类型：【序列化与反序列化】

        /**
         * 1、空结果缓存：解决缓存穿透
         * 2、设置过期时间（加随机值）：解决缓存雪崩
         * 3、加锁：解决缓存击穿
         */
        // 1、加入缓存逻辑，缓存中存的数据是json字符串
        // JSON是跨语言，跨平台兼容
        String catalogJSON = redisTemplate.opsForValue().get("catalogJSON");
        if (StringUtils.isEmpty(catalogJSON)) {
            // 2、缓存中没有，查询数据库
            // 保证数据库查询完成以后，将数据放在redis中，这是一个原子操作
            System.out.println("缓存不命中。。。查询数据库。。。");
            Map<String, List<Catelog2Vo>> catalogJsonFromDb = getCatalogJsonFromDbWithRedisLock();
            return catalogJsonFromDb;
        }

        System.out.println("缓存命中。。。直接返回。。");
        // 转为我们指定的对象
        Map<String, List<Catelog2Vo>> result = JSON.parseObject(catalogJSON, new TypeReference<Map<String, List<Catelog2Vo>>>() {
        });

        return result;
    }

    /**
     * 缓存里面的数据如何和数据库保持一致
     * 缓存数据一致性
     * 1）、双写模式
     * 2）、失效模式
     *
     * @return
     */

    public Map<String, List<Catelog2Vo>> getCatalogJsonFromDbWithRedissonLock() {

        // 1、锁的名字，锁的粒度，越细越快
        //锁的粒度：具体缓存的是某个数据，11-号商品：product-11-lock product-12-lock  product-lock
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

        // 1、占分布式锁。去redis占坑
        String uuid = UUID.randomUUID().toString();
        Boolean lock = redisTemplate.opsForValue().setIfAbsent("lock", uuid, 300, TimeUnit.SECONDS);
        if (lock) {
            System.out.println("获取分布式锁成功。。。");
            // 加锁成功...执行业务
            // 2、设置过期时间,必须和加锁是同步的，原子的
//            redisTemplate.expire("lock", 30, TimeUnit.SECONDS);
            Map<String, List<Catelog2Vo>> dataFromDb;
            try {
                dataFromDb = getDataFromDb();
            } finally {
                String script = "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
                // 删除锁
                Long lock1 = redisTemplate.execute(new DefaultRedisScript<Long>(script, Long.class), Arrays.asList("lock"), uuid);
            }

            //获取值对比+对比成功=原子操作    lua脚本解锁
//            String lockValue = redisTemplate.opsForValue().get("lock");
//            if (uuid.equals(lockValue)) {
//                // 删除自己的锁
//                redisTemplate.delete("lock");// 删除锁
//            }
            return dataFromDb;
        } else {
            // 加锁失败。。。。重试。synchronized()
            // 休眠100ms重试
            System.out.println("获取分布式锁失败。。。等待重试");
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            return getCatalogJsonFromDbWithRedisLock(); // 自旋方式
        }

    }

    private Map<String, List<Catelog2Vo>> getDataFromDb() {
        String catalogJSON = redisTemplate.opsForValue().get("catalogJSON");
        if (StringUtils.isEmpty(catalogJSON)) {
            // 缓存不为null直接返回
            Map<String, List<Catelog2Vo>> result = JSON.parseObject(catalogJSON, new TypeReference<Map<String, List<Catelog2Vo>>>() {
            });

            return result;
        }
        System.out.println("查询了数据库");

        List<CategoryEntity> selectList = baseMapper.selectList(null);

        List<CategoryEntity> level1Category = getParent_cid(selectList, 0L);
        //2、封装数据
        Map<String, List<Catelog2Vo>> parent_cid = level1Category.stream().collect(Collectors.toMap(k -> k.getCatId().toString(), v -> {
            //1、每一个的一级分类，查到这个一级分类的二级分类
            List<CategoryEntity> level2Category = getParent_cid(selectList, v.getCatId());
            List<Catelog2Vo> catelog2Vos = null;
            if (!CollectionUtils.isEmpty(level2Category)) {
                //1、找当前二级分类的三级分类封装vo
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

        // 3、查到的数据再放入缓存,将对象转为json放入缓存中
        String s = JSON.toJSONString(parent_cid);
        redisTemplate.opsForValue().set("catalogJSON", s, 1, TimeUnit.DAYS);
        return parent_cid;
    }

    // 从数据库查询并进行封装分类数据
    public Map<String, List<Catelog2Vo>> getCatalogJsonFromDbWithLocalLock() {

//        // 1、如果缓存中有就用缓存的
//        Map<String, List<Catelog2Vo>> catalogJson = (Map<String, List<Catelog2Vo>>) cache.get("catalogJson");
//        if (cache.get("catalogJson") == null) {
//            // 调用业务
//            // 返回数据放入缓存
//
//            cache.put("catalogJson", parent_cid);
//        }
//
//        return catalogJson;

        // 只要是同一把锁，就能锁住这个锁的所有线程
        //1、synchronized (this)：SpringBoot所有的组件在容器中都是单例的。
        // todo 本地锁：synchronized，JUC（lock），在分布式情况下，想要锁住所有，必须使用分布式锁

        synchronized (this) {
            // 得到锁以后，我们应该再去缓存中确定一次，如果没有才需要继续查询
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
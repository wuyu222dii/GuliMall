package com.atguigu.gulimall.product.web;

import com.atguigu.gulimall.product.entity.CategoryEntity;
import com.atguigu.gulimall.product.service.CategoryService;
import com.atguigu.gulimall.product.vo.Catelog2Vo;
import org.redisson.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Controller
//@RequestMapping("web/index")
public class IndexController {

    @Autowired
    private CategoryService categoryService;
    @Autowired
    RedissonClient redisson;
    @Autowired
    StringRedisTemplate redisTemplate;

    // Rendering a first-level category menu
    @GetMapping({"/", "index.html"})
    public String getIndex(Model model) {
        //Get all first-level categories
        List<CategoryEntity> categoryEntities = categoryService.getLevel1Categorys();
        model.addAttribute("categorys", categoryEntities);
        return "index";
//        return R.ok().setData(categoryEntities);
    }

    // Rendering secondary and tertiary classification data
    @ResponseBody
    @GetMapping("/index/catalog.json")
    public Map<String, List<Catelog2Vo>> getCatelogJson() {
        Map<String, List<Catelog2Vo>> catalogJson = categoryService.getCatalogJson();
        return catalogJson;
//        return R.ok().setData(catelogJson);
    }

    @ResponseBody
    @GetMapping("/hello")
    public String hello() {
        // 1. Obtain a lock. As long as the lock name is the same, it is the same lock.
        RLock lock = redisson.getLock("my-lock");

        // 2, lock
//        lock.lock(); // Blocking waiting, the default locks are30stime
        //1), automatic renewal of the lock. If the business is too long, the lock will be automatically renewed with a new one during operation.30s. Don’t worry about long business hours, the lock will automatically expire and be deleted.
        //2), as long as the locked business is completed, the current lock will not be renewed. Even if it is not manually unlocked, the lock will default to30sIt will be automatically deleted in the future.

        lock.lock(10, TimeUnit.SECONDS); // 10sClock automatically unlocks,The automatic unlocking time must be greater than the business execution time
        // question:lock.lock(10, TimeUnit.SECONDS); After the lock time expires, it will not be automatically renewed.
        //1, if we pass the lock timeout, send it toredisExecute the script and occupy the lock. The default timeout is the time we specify.
        //2, if we do not specify the lock time, use30*1000【LockWatchdogTimeoutDefault time of watchdog];
        // As long as the lock is successfully occupied, a scheduled task will be started [reset the expiration time for the lock, and the new expiration time is the default time of the watchdog],every10swill be automatically renewed again.30s
        // internalLockLeaseTime[Watchdog time]/ 3,10s

        // Best practice
        //1),lock.lock(10, TimeUnit.SECONDS);Saves the entire renewal operation
        try {
            System.out.println("The lock is successful and the business is executed. . ." + Thread.currentThread().getId());
            Thread.sleep(30000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            // 3, unlock will set the unlock code not running,redissonWill there be a deadlock?
            System.out.println("Release the lock. . ." + Thread.currentThread().getId());
            lock.unlock();
        }
        return "hello";
    }

    // It is guaranteed that the latest data can be read. During the modification period, the write lock is a mutual lock (mutex lock). The read lock is a shared lock
    // Reading must wait until the write lock is released.
    @ResponseBody
    @GetMapping("/write")
    public String writeValue() {

        RReadWriteLock lock = redisson.getReadWriteLock("rw-lock");
        String s = "";
        RLock rLock = lock.writeLock();
        try {
            // 1, change data and add write lock, read data and add read lock
            rLock.lock();
            System.out.println("The write lock was successfully added. . ." + Thread.currentThread().getId());
            s = UUID.randomUUID().toString();
            Thread.sleep(30000);
            redisTemplate.opsForValue().set("writeValue", s);
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            rLock.unlock();
            System.out.println("write lock release" + Thread.currentThread().getId());
        }
        return s;
    }


    @ResponseBody
    @GetMapping("/read")
    public String readValue() {
        RReadWriteLock lock = redisson.getReadWriteLock("rw-lock");
        String s = "";
        // Add read lock
        RLock rLock = lock.readLock();
        rLock.lock();
        System.out.println("The read lock was successfully added. . ." + Thread.currentThread().getId());
        try {
            s = redisTemplate.opsForValue().get("writeValue");
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            rLock.unlock();
            System.out.println("read lock release" + Thread.currentThread().getId());
        }
        return s;
    }


    /**
     * garage parking
     * 3parking space
     */
    @ResponseBody
    @GetMapping("/park")
    public String park() throws InterruptedException {
        RSemaphore park = redisson.getSemaphore("park");
        park.acquire(); // Get a signal, get a value

        return "ok";
    }

    @ResponseBody
    @GetMapping("/go")
    public String go() {
        RSemaphore park = redisson.getSemaphore("park");
        park.release(); // free up a parking space
        return "ok";
    }


    /**
     * Vacation, lock the door
     * 1There is no one left in the class.2
     * 5After all classes have finished, we can lock the door
     */
    @ResponseBody
    @GetMapping("/lockDoor")
    public String lockDoor() throws InterruptedException {
        RCountDownLatch door = redisson.getCountDownLatch("door");
        door.trySetCount(5);
        door.await(); // Wait for latching to complete

        return "It's holiday";
    }


    @ResponseBody
    @GetMapping("/gogogo/{id}")
    public String gogogo(@PathVariable("id") Long id) {
        RCountDownLatch door = redisson.getCountDownLatch("door");
        door.countDown(); // count minus one

        return id + "Everyone in the class has left. .";
    }

}

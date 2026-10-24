package com.atguigu.gulimall.product.service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;
@Component
@EnableScheduling
public class SearchSyncWorker {
    @Autowired private SearchSyncService sync;
    private long cursor;
    @Scheduled(initialDelay=15000, fixedDelay=15000) public void retry() { for (Long id : sync.due()) sync.synchronize(id); }
    @Scheduled(initialDelay=60000, fixedDelay=60000) public void stock() { cursor = sync.refreshStock(cursor); }
}

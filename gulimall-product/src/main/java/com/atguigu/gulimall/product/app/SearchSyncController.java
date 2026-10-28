package com.atguigu.gulimall.product.app;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.product.service.SearchSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/product/search-sync")
public class SearchSyncController {
    @Autowired private SearchSyncService sync;
    @GetMapping public R list(@RequestParam org.springframework.util.MultiValueMap<String,String> params) {
        if (params.keySet().stream().anyMatch(k -> !java.util.Arrays.asList("page","limit","spuId","state").contains(k) || params.get(k).size() != 1)) throw new com.atguigu.common.security.ApiProblem(400,"同步查询参数不正确");
        int page = Integer.parseInt(params.getFirst("page") == null ? "1" : params.getFirst("page"));
        int limit = Integer.parseInt(params.getFirst("limit") == null ? "20" : params.getFirst("limit"));
        Long spuId = params.getFirst("spuId") == null || params.getFirst("spuId").isEmpty() ? null : Long.valueOf(params.getFirst("spuId"));
        Integer state = params.getFirst("state") == null || params.getFirst("state").isEmpty() ? null : Integer.valueOf(params.getFirst("state"));
        return R.ok().put("page", sync.list(page,limit,spuId,state));
    }
    @PostMapping("/{id}/publish") public R publish(@PathVariable Long id,@RequestParam int status) { sync.publish(id,status); return result(id); }
    @PostMapping("/{id}/retry") public R retry(@PathVariable Long id) { sync.enqueue(id); return result(id); }
    @PostMapping("/rebuild") public R rebuild() { sync.rebuild(); return R.ok().put("msg", "全量重建任务已持久化，请刷新查看每个商品的同步结果"); }
    private R result(Long id) {
        boolean success = sync.synchronize(id);
        if (!success) throw new com.atguigu.common.security.ApiProblem(503,"目标状态已保存，但搜索同步失败，任务会重试；也可手动重试");
        return R.ok().put("sync", sync.status(id));
    }
}

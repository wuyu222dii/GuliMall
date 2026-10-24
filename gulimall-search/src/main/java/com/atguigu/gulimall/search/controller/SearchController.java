package com.atguigu.gulimall.search.controller;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.search.service.MallSearchService;
import com.atguigu.gulimall.search.vo.SearchParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
@RestController
public class SearchController {
    @Autowired private MallSearchService search;
    @GetMapping({"/search", "/list.html"}) public R search(SearchParam params) { return R.ok().put("page", search.search(params)); }
}

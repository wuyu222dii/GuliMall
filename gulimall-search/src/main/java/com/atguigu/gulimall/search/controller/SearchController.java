package com.atguigu.gulimall.search.controller;

import com.atguigu.gulimall.search.service.MallSearchService;
import com.atguigu.gulimall.search.vo.SearchParam;
import com.atguigu.gulimall.search.vo.SearchResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;


@RestController
public class SearchController {

    @Autowired
    MallSearchService mallsearchService;

    /**
     * 自动将页面提交过来的所有请求查询参数封装成指定的对象
     *
     * @param param
     * @return
     */
    @GetMapping("/list.html")
    public String listPage(SearchParam param, Model model, HttpServletRequest request) {

        param.set_queryString(request.getQueryString());
        // 1、根据传递来的页面的查询参数，去es中检索商品
        SearchResult result = mallsearchService.search(param);

        model.addAttribute("result", result);
        return "list";
    }
}

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
     * Automatically encapsulate all request query parameters submitted by the page into specified objects
     *
     * @param param
     * @return
     */
    @GetMapping("/list.html")
    public String listPage(SearchParam param, Model model, HttpServletRequest request) {

        param.set_queryString(request.getQueryString());
        // 1, according to the query parameters of the passed page, go toesSearch products in
        SearchResult result = mallsearchService.search(param);

        model.addAttribute("result", result);
        return "list";
    }
}

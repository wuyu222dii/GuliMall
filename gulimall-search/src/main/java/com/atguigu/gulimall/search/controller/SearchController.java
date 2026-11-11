package com.atguigu.gulimall.search.controller;
import com.atguigu.common.utils.R;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.search.service.MallSearchService;
import com.atguigu.gulimall.search.vo.SearchParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.util.MultiValueMap;
import java.util.*;
import java.util.stream.Collectors;
@RestController
public class SearchController {
    @Autowired private MallSearchService search;
    // Bind list values explicitly so commas inside an attribute value are not split.
    @InitBinder public void bind(org.springframework.web.bind.WebDataBinder binder) { binder.setAllowedFields("keyword","catalogId","min","max","hasStock","sort","page","limit"); }
    @GetMapping({"/search", "/list.html"}) public R search(SearchParam params, @RequestParam MultiValueMap<String,String> query) {
        Set<String> allowed=new HashSet<>(Arrays.asList("page","limit","keyword","catalogId","catalog3Id","brandId","attrs","min","max","hasStock","sort"));
        query.forEach((key,values)->{if(!allowed.contains(key) || !Arrays.asList("brandId","attrs").contains(key) && values.size()!=1) throw new ApiProblem(400,"查询参数不正确或重复");});
        for(String key:Arrays.asList("page","limit")) if(query.containsKey(key) && !query.getFirst(key).matches("[1-9][0-9]{0,6}")) throw new ApiProblem(400,"分页参数不正确");
        for(String key:Arrays.asList("catalogId","catalog3Id")) if(query.containsKey(key) && !query.getFirst(key).isEmpty() && !query.getFirst(key).matches("0|[1-9][0-9]{0,17}")) throw new ApiProblem(400,"分类参数不正确");
        String alias=query.getFirst("catalog3Id");
        if(alias!=null && !alias.isEmpty()) {
            Long id=Long.valueOf(alias);
            if(params.getCatalogId()!=null && !params.getCatalogId().equals(id)) throw new ApiProblem(400,"分类查询条件冲突");
            params.setCatalogId(id);
        }
        for(String key:Arrays.asList("min","max")) if(query.containsKey(key) && !query.getFirst(key).isEmpty() && !query.getFirst(key).matches("[0-9]{1,12}(\\.[0-9]{1,2})?")) throw new ApiProblem(400,"价格参数不正确");
        if(query.containsKey("hasStock") && !query.getFirst("hasStock").isEmpty() && !query.getFirst("hasStock").matches("[01]")) throw new ApiProblem(400,"库存参数不正确");
        if(query.containsKey("brandId")) {
            List<String> brands=query.get("brandId").stream().flatMap(value->Arrays.stream(value.split(",",-1))).collect(Collectors.toList());
            if(brands.size()>20 || brands.stream().anyMatch(value->!value.matches("[1-9][0-9]{0,17}"))) throw new ApiProblem(400,"品牌参数不正确");
            params.setBrandId(brands.stream().map(Long::valueOf).collect(Collectors.toList()));
        }
        params.setAttrs(query.get("attrs"));
        params.validate();
        return R.ok().put("page", search.search(params));
    }
}

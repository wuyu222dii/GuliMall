package com.atguigu.gulimall.search.vo;
import com.atguigu.common.security.ApiProblem;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
@Data
public class SearchParam {
    private String keyword = "";
    private Long catalogId;
    private List<Long> brandId;
    private BigDecimal min;
    private BigDecimal max;
    private Integer hasStock;
    private String sort = "default";
    private int page = 1;
    private int limit = 12;
    private List<String> attrs;
    public void validate() {
        keyword = keyword == null ? "" : keyword.trim();
        if (keyword.length() > 100 || catalogId != null && catalogId < 0 || brandId != null && (brandId.size() > 20 || brandId.stream().anyMatch(i -> i == null || i < 1))) throw new ApiProblem(400, "关键词、分类或品牌参数不正确");
        for (BigDecimal price : new BigDecimal[]{min,max}) if (price != null && (price.signum() < 0 || price.scale() > 2 || price.compareTo(new BigDecimal("999999999999.99")) > 0)) throw new ApiProblem(400, "价格参数不正确");
        if (min != null && max != null && min.compareTo(max) > 0) throw new ApiProblem(400, "最低价不能高于最高价");
        if (hasStock != null && hasStock != 0 && hasStock != 1 || page < 1 || limit < 1 || limit > 100 || (long) page * limit > 10000) throw new ApiProblem(400, "库存或分页参数不正确，最多浏览前 10000 项");
        if (!"default".equals(sort) && !"price_asc".equals(sort) && !"price_desc".equals(sort)) throw new ApiProblem(400, "排序参数不正确");
        if (attrs != null && (attrs.size() > 20 || attrs.stream().anyMatch(a -> a == null || !a.matches("[1-9][0-9]{0,17}_.{1,255}")))) throw new ApiProblem(400, "属性参数须为 属性编号_值");
    }
}

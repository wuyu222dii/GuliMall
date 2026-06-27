package com.atguigu.gulimall.search.vo;

import com.atguigu.common.to.es.SkuEsModel;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class SearchResult {
    // All product information found
    private List<SkuEsModel> products;

    /**
     * Here is the paging information
     */
    private Integer pageNum;// Current page number
    private Long total; // Total number of records
    private Integer totalPages;// Total page number
    private List<Integer> pageNavs; // The number of navigation pages of the current page

    private List<BrandVo> brands; // Current query results, all related to brands

    private List<CatalogVo> catalogs; // The current query results, all categories involved

    private List<AttrVo> attrs; // The current query results, all attributes involved

    // ==========The above is all the information returned to the page=================

    // Build breadcrumb navigation functionality
    private List<NavVo> navs = new ArrayList<>();
    private List<Long> attrIds = new ArrayList<>();

    @Data
    public static class NavVo {
        private String navName;
        private String navValue;
        private String link;
    }

    @Data
    public static class BrandVo {

        private Long brandId;

        private String brandName;

        private String brandImg;
    }

    @Data
    public static class CatalogVo {

        private Long catalogId;

        private String catalogName;
    }

    @Data
    public static class AttrVo {
        private Long attrId;

        private String attrName;

        private List<String> attrValue;
    }
}

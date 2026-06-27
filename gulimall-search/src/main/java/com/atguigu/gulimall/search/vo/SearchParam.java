package com.atguigu.gulimall.search.vo;

import lombok.Data;

import java.util.List;

/**
 * Encapsulates the query conditions that may be passed from the page
 * <p>
 * catalog3Id=225&keyword=Millet&sort=saleCount_asc&
 */
@Data
public class SearchParam {

    private String keyword; // Full-text matching keywords passed from the page
    private Long catalog3Id; // Third level classificationID

    /**
     * sort=saleCount_asc/desc
     * sort=skuPrice_asc/desc
     * sort=hotScore_asc/desc
     */
    private String sort; //Sorting conditions

    /**
     * Lots of filters
     * hasStock(Is it in stock?),skuPrice(interval),brandId,catalog3Id,attrs
     * hasStock=0/1
     * skuPrice=1_500/_500/500_
     * brandId=1
     * attrs=2_5inch:6inch
     */

    private Integer hasStock; // Whether to only show available goods
    private String skuPrice; // price range
    private List<Long> brandId; // Search by brand, he can select multiple
    private List<String> attrs;// Filter by attributes
    private Integer pageNum = 1; // page number

    private String _queryString; // Original query conditions

}

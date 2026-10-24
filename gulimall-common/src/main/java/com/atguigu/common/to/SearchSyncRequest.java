package com.atguigu.common.to;

import com.atguigu.common.to.es.SkuEsModel;
import lombok.Data;
import java.util.List;

@Data
public class SearchSyncRequest {
    private Long spuId;
    private Long version;
    private boolean onSale;
    private List<SkuEsModel> skus;
}

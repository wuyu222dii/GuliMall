package com.atguigu.gulimall.search.service.impl;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.SearchSyncRequest;
import com.atguigu.common.to.es.SkuEsModel;
import com.atguigu.gulimall.search.constant.EsConstant;
import com.atguigu.gulimall.search.service.ProductSaveService;
import org.apache.http.util.EntityUtils;
import org.elasticsearch.client.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;

@Service
public class ProductSaveServiceImpl implements ProductSaveService {
    @Autowired private RestHighLevelClient client;
    public JSONObject request(String method, String path, String body) {
        try {
            Request request = new Request(method, path);
            if (body != null) request.setJsonEntity(body);
            Response response = client.getLowLevelClient().performRequest(request);
            return response.getEntity() == null ? new JSONObject() : JSON.parseObject(EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8));
        } catch (Exception unavailable) { throw new ApiProblem(503, "Elasticsearch 不可用或索引未就绪，请稍后重试或联系管理员重建索引"); }
    }
    @Override public void ensureIndex() {
        try {
            if (client.getLowLevelClient().performRequest(new Request("HEAD", "/" + EsConstant.PRODUCT_INDEX)).getStatusLine().getStatusCode() == 200) {
                request("PUT", "/" + EsConstant.PRODUCT_INDEX + "/_alias/gulimall-products-write", null);
                return;
            }
        } catch (ResponseException e) {
            if (e.getResponse().getStatusLine().getStatusCode() != 404) throw new ApiProblem(503, "Elasticsearch 索引检查失败");
        } catch (Exception e) { throw new ApiProblem(503, "Elasticsearch 不可用"); }
        try (InputStream source = new ClassPathResource("elasticsearch/products.json").getInputStream()) {
            request("PUT", "/" + EsConstant.PRODUCT_INDEX, StreamUtils.copyToString(source, StandardCharsets.UTF_8));
        } catch (ApiProblem e) {
            request("GET", "/" + EsConstant.PRODUCT_INDEX + "/_mapping", null);
        } catch (Exception e) { throw new ApiProblem(503, "索引创建失败"); }
    }
    @Override public void synchronize(SearchSyncRequest request) {
        if (request == null || request.getSpuId() == null || request.getSpuId() < 1 || request.getVersion() == null || request.getVersion() < 1
                || request.getSkus() == null || request.getSkus().isEmpty() || request.getSkus().size() > 100) throw new ApiProblem(400, "索引同步参数不正确");
        ensureIndex();
        StringBuilder body = new StringBuilder();
        for (SkuEsModel sku : request.getSkus()) {
            if (sku == null || sku.getSkuId() == null || !request.getSpuId().equals(sku.getSpuId())) throw new ApiProblem(400, "SKU 不属于当前 SPU");
            JSONObject metadata = new JSONObject();
            metadata.put("_index", "gulimall-products-write"); metadata.put("_id", sku.getSkuId());
            metadata.put("version", request.getVersion()); metadata.put("version_type", "external_gte");
            JSONObject action = new JSONObject(); action.put(request.isOnSale() ? "index" : "delete", metadata);
            body.append(action.toJSONString()).append('\n');
            if (request.isOnSale()) body.append(JSON.toJSONString(sku)).append('\n');
        }
        // Missing aliases must fail rather than auto-create an index with inferred mappings.
        JSONObject response = request("POST", "/_bulk?refresh=wait_for&require_alias=true", body.toString());
        for (Object value : response.getJSONArray("items")) {
            JSONObject item = ((JSONObject) value).getJSONObject(request.isOnSale() ? "index" : "delete");
            int status = item.getIntValue("status");
            if (status >= 300 && status != 409 && !(status == 404 && !request.isOnSale())) throw new ApiProblem(503, "索引批量同步未全部成功，已保留重试任务");
        }
    }
}

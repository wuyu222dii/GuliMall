package com.atguigu.gulimall.order.config;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.alipay.api.*;
import com.alipay.api.internal.util.AlipaySignature;
import com.alipay.api.request.*;
import com.alipay.api.response.*;
import com.atguigu.common.security.ApiProblem;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.net.URI;
import java.text.SimpleDateFormat;
import java.util.*;

@Component
@ConfigurationProperties(prefix="alipay")
@Data
public class AlipayTemplate {
    private String app_id="", merchant_private_key="", alipay_public_key="", seller_id="", notify_url="", return_url="";
    private String gatewayUrl="https://openapi-sandbox.dl.alipaydev.com/gateway.do";
    @Autowired private Environment environment;
    public boolean localTest() { return environment.acceptsProfiles("payment-test"); }
    public boolean ready() { try { configured(); return true; } catch(Exception unavailable) { return false; } }
    public void configured() {
        if(app_id.trim().isEmpty() || merchant_private_key.trim().isEmpty() || alipay_public_key.trim().isEmpty() || seller_id.trim().isEmpty() || notify_url.trim().isEmpty() || return_url.trim().isEmpty()) throw new ApiProblem(503,"支付宝沙箱尚未配置，请联系管理员；本地验证不能替代沙箱验收");
        URI uri=URI.create(gatewayUrl);
        boolean sandbox="https".equals(uri.getScheme()) && (uri.getPort()==-1 || uri.getPort()==443) && Arrays.asList("openapi-sandbox.dl.alipaydev.com","openapi.alipaydev.com").contains(uri.getHost()) && "/gateway.do".equals(uri.getPath());
        boolean test=localTest() && "http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost()) && "/gateway.do".equals(uri.getPath());
        if(uri.getUserInfo()!=null || uri.getFragment()!=null || uri.getQuery()!=null) throw new ApiProblem(503,"支付网关地址不正确");
        if(!sandbox && !test) throw new ApiProblem(503,"本轮仅允许支付宝沙箱，测试网关仅在 payment-test 配置启用");
    }
    private DefaultAlipayClient client() {
        configured(); DefaultAlipayClient client=new DefaultAlipayClient(gatewayUrl,app_id,merchant_private_key,"json","UTF-8",alipay_public_key,"RSA2");
        client.setConnectTimeout(2000); client.setReadTimeout(5000); return client;
    }
    public static String timestamp(Date date) {
        SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"); format.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai")); return format.format(date);
    }
    public static Date paymentTime(String value) {
        try { SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"); format.setLenient(false); format.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai")); Date parsed=format.parse(value); if(!format.format(parsed).equals(value)) throw new IllegalArgumentException(); return parsed; }
        catch(Exception invalid) { throw new ApiProblem(400,"支付时间不正确"); }
    }
    public static BigDecimal amount(String value) {
        if(value==null || !value.matches("[0-9]{1,18}(\\.[0-9]{1,2})?")) throw new ApiProblem(400,"支付金额不正确");
        return new BigDecimal(value);
    }
    public String form(String sn,BigDecimal amount,String subject,Date deadline) {
        try {
            AlipayTradePagePayRequest request=new AlipayTradePagePayRequest(); request.setNotifyUrl(notify_url);
            request.setReturnUrl(return_url+(return_url.contains("?")?"&":"?")+"orderSn="+sn);
            Map<String,Object> biz=new LinkedHashMap<>(); biz.put("out_trade_no",sn); biz.put("total_amount",amount.toPlainString()); biz.put("subject",subject); biz.put("product_code","FAST_INSTANT_TRADE_PAY"); biz.put("time_expire",timestamp(deadline)); biz.put("seller_id",seller_id);
            request.setBizContent(JSON.toJSONString(biz)); return client().pageExecute(request).getBody();
        } catch(AlipayApiException failure) { throw new ApiProblem(503,"支付表单生成失败，请查询原订单后重试"); }
    }
    public void verify(Map<String,String> params) {
        configured();
        if(!"RSA2".equals(params.get("sign_type")) || !app_id.equals(params.get("app_id")) || !seller_id.equals(params.get("seller_id"))) throw new ApiProblem(403,"支付应用或收款方不匹配");
        try { if(!AlipaySignature.rsaCheckV1(new HashMap<>(params),alipay_public_key,"UTF-8","RSA2")) throw new ApiProblem(403,"支付通知验签失败"); }
        catch(AlipayApiException invalid) { throw new ApiProblem(403,"支付通知验签失败"); }
    }
    @Data public static class Trade {
        private String state, orderSn, tradeNo;
        private BigDecimal amount;
        private Date paidAt;
    }
    public Trade query(String sn) {
        try {
            AlipayTradeQueryRequest request=new AlipayTradeQueryRequest(); request.setBizContent(JSON.toJSONString(Collections.singletonMap("out_trade_no",sn)));
            AlipayTradeQueryResponse response=client().execute(request); Trade trade=new Trade(); trade.setOrderSn(sn);
            if(!response.isSuccess()) {
                if("ACQ.TRADE_NOT_EXIST".equals(response.getSubCode())) { trade.setState("ABSENT"); return trade; }
                throw new ApiProblem(503,"支付宝查询结果未知，保留库存并重试");
            }
            if(!sn.equals(response.getOutTradeNo())) throw new ApiProblem(503,"支付宝返回订单不匹配");
            trade.setState(response.getTradeStatus()); trade.setTradeNo(response.getTradeNo()); trade.setAmount(amount(response.getTotalAmount()));
            JSONObject body=JSON.parseObject(response.getBody()).getJSONObject("alipay_trade_query_response");
            if(body.containsKey("seller_id") && !seller_id.equals(body.getString("seller_id"))) throw new ApiProblem(503,"支付宝收款方不匹配");
            if(body.getString("send_pay_date")!=null) trade.setPaidAt(paymentTime(body.getString("send_pay_date")));
            return trade;
        } catch(AlipayApiException failure) { throw new ApiProblem(503,"支付宝查询失败，保留库存并重试"); }
    }
    public boolean close(String sn) {
        try {
            AlipayTradeCloseRequest request=new AlipayTradeCloseRequest(); request.setBizContent(JSON.toJSONString(Collections.singletonMap("out_trade_no",sn)));
            AlipayTradeCloseResponse response=client().execute(request);
            if(response.isSuccess() && !sn.equals(response.getOutTradeNo())) throw new ApiProblem(503,"支付宝关单结果不匹配");
            return response.isSuccess();
        } catch(AlipayApiException failure) { throw new ApiProblem(503,"支付宝关单结果未知，保留库存并重试"); }
    }
}

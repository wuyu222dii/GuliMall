package com.atguigu.gulimall.order;
import com.alipay.api.internal.util.AlipaySignature;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.order.config.AlipayTemplate;
import com.atguigu.gulimall.order.entity.OrderEntity;
import org.junit.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import java.security.*;
import java.util.*;
import static org.junit.Assert.*;
public class AlipaySafetyTest {
    private AlipayTemplate configured(KeyPair provider,MockEnvironment env) {
        AlipayTemplate template=new AlipayTemplate(); ReflectionTestUtils.setField(template,"environment",env);
        template.setApp_id("test-app");template.setSeller_id("test-seller");template.setMerchant_private_key(Base64.getEncoder().encodeToString(provider.getPrivate().getEncoded()));template.setAlipay_public_key(Base64.getEncoder().encodeToString(provider.getPublic().getEncoded()));template.setNotify_url("http://127.0.0.1:88/api/payments/alipay/notify");template.setReturn_url("http://127.0.0.1:5173/payment/return");return template;
    }
    @Test public void rsa2AndBusinessIdentityAreRequiredForNotifications() throws Exception {
        KeyPairGenerator generator=KeyPairGenerator.getInstance("RSA");generator.initialize(2048);KeyPair pair=generator.generateKeyPair();
        AlipayTemplate template=configured(pair,new MockEnvironment()); Map<String,String> params=new HashMap<>();params.put("app_id","test-app");params.put("seller_id","test-seller");params.put("out_trade_no","a");
        params.put("sign",AlipaySignature.rsaSign(AlipaySignature.getSignContent(params),template.getMerchant_private_key(),"UTF-8","RSA2"));params.put("sign_type","RSA2");template.verify(params);
        params.put("out_trade_no","tampered");try{template.verify(params);fail();}catch(ApiProblem e){assertEquals(403,e.getStatus());}
        params.put("app_id","wrong");try{template.verify(params);fail();}catch(ApiProblem e){assertEquals(403,e.getStatus());}
    }
    @Test public void onlySandboxOrExplicitLoopbackTestGatewaysAndExactAmountsAreAccepted() throws Exception {
        KeyPairGenerator generator=KeyPairGenerator.getInstance("RSA");generator.initialize(2048);MockEnvironment env=new MockEnvironment();AlipayTemplate template=configured(generator.generateKeyPair(),env);
        template.setGatewayUrl("https://openapi.alipay.com/gateway.do");assertFalse(template.ready());
        template.setGatewayUrl("http://127.0.0.1:18170/gateway.do");assertFalse(template.ready());env.setActiveProfiles("payment-test");assertTrue(template.ready());
        assertEquals("1970-01-01 08:00:00",AlipayTemplate.timestamp(new Date(0)));assertEquals(new Date(0),AlipayTemplate.paymentTime("1970-01-01 08:00:00"));
        for(String value:Arrays.asList("NaN","-1","1.001","1e2"))try{AlipayTemplate.amount(value);fail();}catch(ApiProblem e){assertEquals(400,e.getStatus());}
    }
    @Test public void fulfillmentRequiresBothPaymentAndInventoryConfirmation() {
        OrderEntity order=new OrderEntity();order.setStatus(1);order.setPaymentTradeNo("trade");order.setInventoryStatus(0);assertFalse(order.isFulfillmentReady());order.setInventoryStatus(1);assertTrue(order.isFulfillmentReady());order.setStatus(9);assertFalse(order.isFulfillmentReady());
    }
}

package com.atguigu.gulimall.thirdparty.component;

import com.atguigu.gulimall.thirdparty.util.HttpUtils;
import lombok.Data;
import org.apache.http.HttpResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

//@ConfigurationProperties(prefix = "spring.cloud.alicloud.sms")
@Component
@Data
public class SmsComponent {

    @Value("${spring.cloud.alicloud.sms.host}")
    private String host;
    @Value("${spring.cloud.alicloud.sms.path}")
    private String path;
    @Value("${spring.cloud.alicloud.sms.sms-sign-id}")
    private String smsSignId;
    @Value("${spring.cloud.alicloud.sms.template-code}")
    private String templateCode;
    @Value("${spring.cloud.alicloud.sms.appcode}")
    private String appcode;


    public void sendCode(String phone, String code, String minute) {
        String method = "POST";
        Map<String, String> headers = new HashMap<String, String>();
        // Header format (space-separated): Authorization:APPCODE 83359fd73fe94948385f570e3c139105
        headers.put("Authorization", "APPCODE " + appcode);
        Map<String, String> querys = new HashMap<String, String>();
        querys.put("mobile", phone);
        querys.put("param", "**code**:" + code + "**minute**:" + minute);

// smsSignId (SMS prefix) and templateId (SMS template) can be applied in Guoyang Cloud console. Docs: http://help.guoyangyun.com/Problem/Qm.html

        querys.put("smsSignId", smsSignId);
        querys.put("templateId", templateCode);
        Map<String, String> bodys = new HashMap<String, String>();


        try {
            /**
             * Important notes:
             * Download HttpUtils from https://github.com/aliyun/api-gateway-demo-sign-java/blob/master/src/main/java/com/aliyun/api/gateway/demo/util/HttpUtils.java
             *
             * See the project for required dependencies
             * https://github.com/aliyun/api-gateway-demo-sign-java/blob/master/pom.xml
             */
            HttpResponse response = HttpUtils.doPost(host, path, method, headers, querys, bodys);
            System.out.println(response.toString());
            // Get response body
            //System.out.println(EntityUtils.toString(response.getEntity()));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

package com.atguigu.gulimall.thirdparty;


import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClient;
import com.atguigu.gulimall.thirdparty.component.SmsComponent;
import com.atguigu.gulimall.thirdparty.util.HttpUtils;
import org.apache.http.HttpResponse;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

@SpringBootTest
@RunWith(SpringRunner.class)
public class GulimallThirdPartyApplicationTests {
    @Autowired
    OSSClient ossClient;

    @Autowired
    SmsComponent smsComponent;

    @Test
    public void contextLoads() {
        smsComponent.sendCode("15557880371", "1234","15");
    }


    @Test
    public void sendSms(){
        String host = "https://gyytz.market.alicloudapi.com";
        String path = "/sms/smsSend";
        String method = "POST";
        String appcode = "your-appcode";
        Map<String, String> headers = new HashMap<String, String>();
        // Header format (space-separated): Authorization:APPCODE 83359fd73fe94948385f570e3c139105
        headers.put("Authorization", "APPCODE " + appcode);
        Map<String, String> querys = new HashMap<String, String>();
        querys.put("mobile", "15557880371");
        querys.put("param", "**code**:899883,**minute**:5");

// smsSignId (SMS prefix) and templateId (SMS template) can be applied in Guoyang Cloud console. Docs: http://help.guoyangyun.com/Problem/Qm.html

        querys.put("smsSignId", "2e65b1bb3d054466b82f0c9d125465e2");
        querys.put("templateId", "908e94ccf08b4476ba6c876d13f084ad");
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

    @Test
    public void testUpload() throws FileNotFoundException {
        // Upload file stream
        InputStream inputStream = new FileInputStream("/Users/harry/Documents/2.jpg");
        ossClient.putObject("harry-gulimall", "hhh.jpg", inputStream);
        // Close OSSClient.
        ossClient.shutdown();

        System.out.println("Upload successful");
    }
}

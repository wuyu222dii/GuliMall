package com.atguigu.gulimall.thirdparty;

import com.atguigu.gulimall.thirdparty.component.SmsComponent;
import com.atguigu.gulimall.thirdparty.controller.OssController;
import com.atguigu.gulimall.thirdparty.controller.SmsSendController;
import org.junit.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

public class LocalThirdPartyConfigurationTest {
    @Test
    public void paidConnectorsAreAbsentWithoutExplicitOptIn() {
        new ApplicationContextRunner()
                .withUserConfiguration(OssController.class, SmsComponent.class, SmsSendController.class)
                .run(context -> {
                    assertThat(context).doesNotHaveBean(OssController.class);
                    assertThat(context).doesNotHaveBean(SmsComponent.class);
                    assertThat(context).doesNotHaveBean(SmsSendController.class);
                });
    }
}

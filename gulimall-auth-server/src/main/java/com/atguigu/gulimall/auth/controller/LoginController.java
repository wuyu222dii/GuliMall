package com.atguigu.gulimall.auth.controller;

import com.atguigu.common.constant.AuthServerConstant;
import com.atguigu.common.exception.BizCodeEnume;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.auth.feign.ThirdPartyFeignService;
import com.atguigu.gulimall.auth.vo.UserRegistryVo;
import org.apache.commons.lang.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Controller
public class LoginController {
    @Autowired
    ThirdPartyFeignService thirdPartyFeignService;
    @Autowired
    StringRedisTemplate redisTemplate;

    /**
     * Login request
     * Send a request to redirect to a page
     * SpringMVC ViewController: maps requests to pages
     *
     * @return
     */
    @ResponseBody
    @GetMapping("/sms/sendcode")
    public R sendCode(@RequestParam("phone") String phone) {
        // todo 1. Rate limiting for the API
        String redisCode = redisTemplate.opsForValue().get(AuthServerConstant.SMS_CODE_CACHE_PREFIX + phone);
        if (StringUtils.isEmpty(redisCode)) {
            long l = Long.parseLong(redisCode.split("_")[1]);
            if (System.currentTimeMillis() - l < 60000) {
                // Cannot resend within 60 seconds
                return R.error(BizCodeEnume.SMS_CODE_EXCEPTION.getCode(), BizCodeEnume.SMS_CODE_EXCEPTION.getMsg());
            }
        }

        // 2. Re-validate verification code. Redis stores key-phone, value-code
        String code = UUID.randomUUID().toString().substring(0, 5) + "_" + System.currentTimeMillis();
        String minutes = "10";
        // Cache verification code in Redis to prevent resending within 60 seconds for the same phone
        redisTemplate.opsForValue().set(AuthServerConstant.SMS_CODE_CACHE_PREFIX + phone, code, 10, TimeUnit.MINUTES);

        thirdPartyFeignService.sendCode(phone, code, minutes);
        return R.ok();
    }

    @PostMapping("/registry")
    public String registry(@Valid UserRegistryVo vo, BindingResult result, Model model) {
        if (result.hasErrors()) {
            // 1. If validation fails, forward to registration page
            Map<String, String> errors = new HashMap<>();
            // Get validation error messages
            result.getFieldErrors().forEach((item) -> {
                // fieldError gets the error message
                String message = item.getDefaultMessage();
                // Get the error field
                String field = item.getField();
                errors.put(field, message);
            });
            model.addAttribute("errors", errors);
        }
        // 2. If validation succeeds, register

        // Redirect to login page after successful registration
        return "redirect:/login.html";
    }
}

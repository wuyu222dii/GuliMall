package com.atguigu.gulimall.product.service;

import com.atguigu.common.security.ApiProblem;
import java.math.BigDecimal;
import java.net.URI;

public final class ProductInputs {
    private ProductInputs() { }
    public static String text(String value, int max, String label) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > max) throw new ApiProblem(400, label + "不正确");
        return value.trim();
    }
    public static void amount(BigDecimal value, String label) {
        if (value == null || value.signum() < 0 || value.scale() > 2 || value.compareTo(new BigDecimal("999999999999.99")) > 0)
            throw new ApiProblem(400, label + "必须为非负金额，最多两位小数");
    }
    public static void image(String value) {
        if (value == null || value.length() > 1000) throw new ApiProblem(400, "图片地址不正确");
        if (value.matches("/api/media/[a-f0-9]{32}\\.(png|jpg)") || value.equals("/demo-product.svg") || value.equals("/image-unavailable.svg")) return;
        try {
            URI uri = URI.create(value);
            if (("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())) && uri.getHost() != null && uri.getUserInfo() == null) return;
        } catch (IllegalArgumentException ignored) { }
        throw new ApiProblem(400, "图片地址必须是上传图片或 HTTP(S) 地址");
    }
}

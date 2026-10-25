package com.atguigu.common.security;

import com.atguigu.common.utils.R;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableRedisHttpSession(redisNamespace = "gulimall:session", maxInactiveIntervalInSeconds = 7200)
@Import(ApiErrorAdvice.class)
public class ServletSecurityConfiguration implements WebMvcConfigurer {
    private final String internalToken;
    private final ObjectMapper mapper;
    public ServletSecurityConfiguration(@Value("${INTERNAL_API_TOKEN}") String token, ObjectMapper mapper) {
        if (token.length() < 32) { throw new IllegalStateException("INTERNAL_API_TOKEN must have at least 32 characters"); }
        this.internalToken = token;
        this.mapper = mapper;
    }
    @Bean
    public DefaultCookieSerializer cookieSerializer(@Value("${gulimall.session.secure:false}") boolean secure) {
        DefaultCookieSerializer cookie = new DefaultCookieSerializer();
        cookie.setCookieName("GULIMALLSESSION");
        cookie.setCookiePath("/");
        cookie.setUseHttpOnlyCookie(true);
        cookie.setSameSite("Lax");
        cookie.setUseSecureCookie(secure);
        return cookie;
    }
    public static boolean equal(String a, String b) {
        return a != null && b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
                String path = request.getServletPath();
                String method = request.getMethod();
                response.setHeader("Cache-Control", "no-store");
                if (("GET".equals(method) || "HEAD".equals(method)) && path.matches(".*/(save|update|delete|merge|received|done|up)(/.*)?")) {
                    return deny(response, 405, "修改操作必须使用 POST/PUT/DELETE");
                }
                if (equal(internalToken, request.getHeader("X-Internal-Token"))) { return true; }
                if (path.startsWith("/internal/")) { return deny(response, 403, "内部接口禁止访问"); }
                // Alipay authenticates this exact server callback with RSA2, independently of Redis Session.
                if (path.equals("/payments/alipay/notify") && "POST".equals(method)) { return true; }
                boolean read = "GET".equals(method);
                boolean publicPath = path.matches("/auth/(csrf|me|login|register|sms/code|admin/login)")
                        || read && (path.equals("/index/catalog.json") || path.equals("/product/category/list/tree")
                        || path.equals("/product/items") || path.matches("/product/items/[^/]+(/purchase-check)?")
                        || path.equals("/product/categories") || path.equals("/product/brands")
                        || path.matches("/media/[a-f0-9]{32}\\.(png|jpg)")
                        || path.equals("/coupon/homeadv/list") || path.equals("/coupon/homesubject/list")
                        || path.equals("/list.html") || path.equals("/search"))
                        || path.equals("/ware/waresku/hasstock") && "POST".equals(method);
                SessionUser user = RequestIdentity.user(request);
                if (!publicPath) {
                    if (user == null) { return deny(response, 401, "请先登录"); }
                    boolean memberPath = path.startsWith("/member/addresses") || path.startsWith("/order/mine")
                            || path.equals("/cart") || path.startsWith("/cart/")
                            || path.equals("/auth/logout") || path.equals("/aliPayOrder");
                    if (!memberPath && !user.isAdmin()) { return deny(response, 403, "需要管理员权限"); }
                    if (memberPath && !path.equals("/auth/logout") && user.isAdmin()) { return deny(response, 403, "需要会员身份"); }
                }
                if (!read && !"HEAD".equals(method) && !"OPTIONS".equals(method)) {
                    HttpSession session = request.getSession(false);
                    String expected = session == null ? null : (String) session.getAttribute("csrfToken");
                    if (!equal(expected, request.getHeader("X-CSRF-Token"))) { return deny(response, 403, "请求校验失败，请刷新页面后重试"); }
                }
                return true;
            }
        });
    }
    private boolean deny(HttpServletResponse response, int status, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        mapper.writeValue(response.getWriter(), R.error(status, message));
        return false;
    }
}

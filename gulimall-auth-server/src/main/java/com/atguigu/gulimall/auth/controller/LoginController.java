package com.atguigu.gulimall.auth.controller;

import com.atguigu.common.constant.AuthServerConstant;
import com.atguigu.common.security.*;
import com.atguigu.common.utils.R;
import com.alibaba.fastjson.TypeReference;
import com.atguigu.gulimall.auth.feign.MemberIdentityFeignService;
import com.atguigu.gulimall.auth.service.VerificationCodeService;
import feign.FeignException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import javax.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class LoginController {
    @Autowired private MemberIdentityFeignService members;
    @Autowired private VerificationCodeService codes;
    @Autowired private StringRedisTemplate redis;
    @Value("${ADMIN_USER:admin}") private String adminUser;
    @Value("${ADMIN_PASSWORD_HASH:}") private String adminHash;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    @GetMapping("/csrf")
    public R csrf(HttpServletRequest request) {
        HttpSession session = request.getSession();
        String token = (String) session.getAttribute("csrfToken");
        if (token == null) { token = UUID.randomUUID().toString(); session.setAttribute("csrfToken", token); }
        return R.ok().put("csrfToken", token);
    }
    @GetMapping("/me")
    public R me(HttpServletRequest request) {
        SessionUser user = RequestIdentity.user(request);
        if (user == null) { throw new ApiProblem(401, "请先登录"); }
        return R.ok().put("user", user);
    }
    @PostMapping("/sms/code")
    public R sendCode(@RequestBody Map<String,String> body) {
        String phone = body.get("phone");
        if (phone == null || !phone.matches("1[3-9][0-9]{9}")) { throw new ApiProblem(400, "手机号格式不正确"); }
        return R.ok().put("mode", "development").put("developmentCode", codes.send(phone));
    }
    @PostMapping("/register")
    public R register(@Valid @RequestBody RegistrationRequest body, HttpServletRequest request) {
        codes.verify(body.getPhone(), body.getCode());
        try {
            SessionUser user = members.register(body).getData("user", new TypeReference<SessionUser>() {});
            codes.consume(body.getPhone(), body.getCode());
            return establish(request, user);
        } catch (FeignException e) { throw remoteFailure(e); }
    }
    @PostMapping("/login")
    public R login(@Valid @RequestBody Credentials body, HttpServletRequest request) {
        limit(body, "member");
        try {
            return establish(request, members.login(body).getData("user", new TypeReference<SessionUser>() {}));
        } catch (FeignException e) { throw remoteFailure(e); }
    }
    @PostMapping("/admin/login")
    public R adminLogin(@Valid @RequestBody Credentials body, HttpServletRequest request) {
        limit(body, "admin");
        if (!adminHash.matches("\\$2[aby]\\$[0-9]{2}\\$.{53}")) { throw new ApiProblem(503, "管理员账号未配置"); }
        boolean matches = passwords.matches(body.getPassword(), adminHash);
        if (!matches || !adminUser.equals(body.getUsername())) { throw new ApiProblem(401, "用户名或密码不正确"); }
        return establish(request, new SessionUser(null, adminUser, true));
    }
    @PostMapping("/logout")
    public R logout(HttpServletRequest request) {
        request.getSession().invalidate();
        return R.ok();
    }
    private R establish(HttpServletRequest request, SessionUser user) {
        if (user == null) { throw new ApiProblem(503, "会员服务暂时不可用"); }
        request.getSession();
        request.changeSessionId();
        HttpSession session = request.getSession();
        String csrf = UUID.randomUUID().toString();
        session.setAttribute(AuthServerConstant.LOGIN_USER, user);
        session.setAttribute("csrfToken", csrf);
        return R.ok().put("user", user).put("csrfToken", csrf);
    }
    private void limit(Credentials body, String kind) {
        if (body.getPassword().getBytes(StandardCharsets.UTF_8).length > 72) { throw new ApiProblem(400, "密码长度不正确"); }
        String script = "local n=redis.call('INCR',KEYS[1]) if n==1 then redis.call('EXPIRE',KEYS[1],60) end return n";
        Long n = redis.execute(new DefaultRedisScript<>(script, Long.class), Collections.singletonList("auth:attempt:"+kind+":"+body.getUsername().toLowerCase(Locale.ROOT)));
        if (n == null || n > 10) { throw new ApiProblem(429, "尝试次数过多，请稍后重试"); }
    }
    private ApiProblem remoteFailure(FeignException error) {
        if (error.status() == 401) { return new ApiProblem(401, "用户名或密码不正确"); }
        if (error.status() == 409) { return new ApiProblem(409, "用户名或手机号已使用"); }
        if (error.status() == 400) { return new ApiProblem(400, "注册资料不正确"); }
        return new ApiProblem(503, "会员服务暂时不可用，请稍后重试");
    }
}

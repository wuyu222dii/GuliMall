package com.atguigu.common.security;

import com.atguigu.common.constant.AuthServerConstant;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

public final class RequestIdentity {
    private RequestIdentity() { }
    public static SessionUser user(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (SessionUser) session.getAttribute(AuthServerConstant.LOGIN_USER);
    }
    public static long memberId(HttpServletRequest request) {
        SessionUser user = user(request);
        if (user == null) { throw new ApiProblem(401, "请先登录"); }
        if (user.isAdmin() || user.getId() == null) { throw new ApiProblem(403, "此接口仅供会员使用"); }
        return user.getId();
    }
}

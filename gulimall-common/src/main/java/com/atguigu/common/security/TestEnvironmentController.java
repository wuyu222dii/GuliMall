package com.atguigu.common.security;

import com.atguigu.common.utils.R;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import javax.sql.DataSource;
import java.sql.Connection;

@Profile("test")
@RestController
public class TestEnvironmentController {
    private final ObjectProvider<DataSource> sources;
    public TestEnvironmentController(ObjectProvider<DataSource> sources) { this.sources=sources; }
    @GetMapping("/internal/test-environment")
    public R environment() throws Exception {
        DataSource source=sources.getIfAvailable();
        if(source==null) return R.ok().put("catalog",null);
        try(Connection connection=source.getConnection()) { return R.ok().put("catalog",connection.getCatalog()); }
    }
}

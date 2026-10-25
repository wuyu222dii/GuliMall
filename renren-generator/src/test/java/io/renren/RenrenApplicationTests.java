package io.renren;

import org.junit.Test;
import org.junit.Ignore;
import org.junit.runner.RunWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@Ignore("Legacy manual demo: may mutate databases or call paid external APIs; replace with isolated tests before enabling.")
@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest
public class RenrenApplicationTests {

	@Test
	public void contextLoads() {
	}

}

# 历史手工测试与替代覆盖

阶段 21 复核了原来记录的“9 项忽略”：源码中为 **9 个类级 `@Ignore`，合计 17 个 `@Test` 方法**。JUnit 对整类忽略通常只生成一个跳过记录，因此 Maven 的 9 个 skipped 不能理解为仅有 9 个方法，更不能计入通过数。实际构建统计见 [阶段 21 验收](STAGE21.md)。

这些类继续保留 `@Ignore` 和 `@ActiveProfiles("test")`，本轮不删除注解、不启用真实短信/OSS，也不让其连接演示库。替代覆盖按商城业务行为描述，不将打印输出、通用 ES 示例或本地模拟通过当作真实供应商验收。

| 历史测试类 | 手工方法数 | 保留原因 | 当前替代覆盖与边界 |
|---|---:|---|---|
| [Product](../gulimall-product/src/test/java/com/atguigu/gulimall/product/GulimallProductApplicationTests.java) | 5 | 固定 SKU/分类、打印 Redisson、写 Redis 和直接插入品牌，无可重复清理与断言 | CategoryCatalogTest、SkuItemTest；Product/Admin 套件及 Browser 验证分类、规格、商品维护与采购。Session/Cart/Recovery 覆盖实际 Redis 读写持久化；打印 Redisson 对象本身没有业务验收意义 |
| [Search](../gulimall-search/src/test/java/com/atguigu/gulimall/search/GulimallSearchApplicationTests.java) | 3 | 手工读写固定 ES 示例索引，输出查询和聚合结果 | SearchQueryTest、Search 套件及恢复演练验证商城映射、筛选、同步重试与商品库重建；通用 bank 聚合示例未迁移，也不属于商城主线 |
| [ThirdParty](../gulimall-third-party/src/test/java/com/atguigu/gulimall/thirdparty/GulimallThirdPartyApplicationTests.java) | 3 | 真实云短信调用、固定文件路径和 OSS 上传，可能产生费用 | VerificationCodeServiceTest、ThirdPartyFeignServiceTest、LocalImageStoreTest、Auth/Admin/Browser/Recovery 覆盖开发验证码与本地存储。真实短信送达、OSS 权限和外部失败语义仍未验证 |
| [Member](../gulimall-member/src/test/java/com/atguigu/gulimall/member/GulimallMemberApplicationTests.java) | 1 | 空的 Spring 上下文测试，依赖运行配置和数据库，没有业务断言 | MemberIdentityTest；Auth 及订单、地址和浏览器场景验证注册、密码、会话和会员归属 |
| [Order](../gulimall-order/src/test/java/com/atguigu/gulimall/order/GulimallOrderApplicationTests.java) | 1 | 空上下文测试，不能证明下单或支付正确 | OrderCreation/AlipaySafety/OrderShipment/OrderProcessing/TestEnvironmentGuard 单元检查；Order/Payment/Fulfillment、Browser 和两类 Recovery 覆盖真实业务链 |
| [Ware](../gulimall-ware/src/test/java/com/atguigu/gulimall/ware/GulimallWareApplicationTests.java) | 1 | 空上下文测试，没有库存结果断言 | StockReservationTest；Admin/Order/Payment 与恢复演练验证采购幂等、并发锁库、回滚、扣减和释放 |
| [Gateway](../gulimall-gateway/src/test/java/com/atguigu/gulimall/gateway/GulimallGatewayApplicationTests.java) | 1 | 空上下文测试，没有路由与边界断言 | LocalOriginTest、Auth 套件及浏览器通过同源 `/api` 验证路由、CSRF 和权限保护 |
| [Coupon](../gulimall-coupon/src/test/java/com/atguigu/gulimall/coupon/GulimallCouponApplicationTests.java) | 1 | 空上下文测试，没有营销结算断言 | 构建及运行诊断核对该服务可启动/注册。优惠券、积分和营销结算继续后置，不宣称已有业务替代验收 |
| [Generator](../renren-generator/src/test/java/io/renren/RenrenApplicationTests.java) | 1 | 空上下文测试，代码生成器不是演示主线必需服务 | 聚合构建检查编译；生成器运行及生成代码正确性没有新增验收，继续单独处理 |

## 测试数据规则

- 单元检查不依赖外部运行环境；需要数据库的业务回归统一通过 `scripts/test.ps1`，先确认真实数据源为 `_test`。
- Demo 完整恢复使用独立入口、全新依赖和私有副本，不放宽 Test 的拒绝条件，不直接导入原演示库。
- 如未来迁移某个旧方法，应先将固定 ID、硬编码路径与供应商调用替换成独立夹具和可验证业务结果，再决定是否保留原示例。不能只移除 Ignore 来增加通过数量。
- 自然 Session TTL、独立机器、第二位操作者、真实供应商与公网验证仍单列待办，不由这些旧类或本机模拟结果代替。

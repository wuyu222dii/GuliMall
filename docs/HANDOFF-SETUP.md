# 阶段 18：干净目录与本机隔离交接

范围：Windows、Java 8、Maven 3.x、现有 React 和 Docker Desktop Linux。仍为开发验证码、本地图片和 LOCAL_TEST 付款，无真实资金或公网。独立机器与第二位操作者验收继续待补；同机新目录不能替代该证据。

## 首次准备与启动

1. 克隆项目并进入根目录。安装 JDK 8（必须含 javac）、Maven 3.6+ 的 3.x、Node 20.19+、npm 9+、Git，以及带 Compose v2+ 的 Docker Desktop Linux 引擎。
2. 在当前 PowerShell 设置 JAVA_HOME 和 PATH，确保 `java`、`mvn`、`node`、`npm`、`git`、`docker` 可用。不要依赖其他人的 `.tools/enter-dev.ps1`；该文件、机器工具、.env、图片、台账和私有账号均不随 Git 分发。Maven 必须实际使用 JDK 8。
3. 普通构建需要获取 Maven/npm 依赖，首次启动需要拉镜像。可以复用机器缓存；本阶段不承诺离线构建或全新操作系统安装。不要把项目源码路径中的 npm 包或 JDK 当作交接工具安装。

```powershell
./scripts/setup.ps1
# 不覆盖已有 .env；不要把旧机器 .env 或数据卷复制到新空环境冒充初始化。
./scripts/preflight.ps1 -Mode Build
./scripts/dev.ps1 Build
./scripts/dev.ps1 Check

# 交互输入接收者自己的管理员密码；将输出摘要私下配置到 .env：
java '-Dloader.main=com.atguigu.gulimall.auth.tool.AdminPasswordTool' -cp gulimall-auth-server/target/gulimall-auth-server-0.0.1-SNAPSHOT.jar org.springframework.boot.loader.PropertiesLauncher
# 设置 ADMIN_USER；ADMIN_PASSWORD_HASH='$2a$...' 保留外层单引号。

./scripts/preflight.ps1 -Mode Simulation
./scripts/simulation.ps1 Start
./scripts/search-index.ps1
./scripts/simulation.ps1 Diagnose
```

入口 http://127.0.0.1:8080，后台 /admin。首次新卷由现有 Compose SQL 初始化；已有数据库禁止重新初始化或删卷。按 [交接检查表](DEMO-HANDOFF.md) 完成上架/重建搜索、成功交易与取消，再 Stop / Start 核对原订单。模拟签名配置与付款台账自动独立生成，后续恢复必须保留原匹配密钥。

本机停服务用 simulation.ps1 Stop；停基础设施另用 dev.ps1 Down。两者保留数据。没有开机自启任务；机器重启后需启动 Docker 并执行 simulation.ps1 Start。

## 预检入口

| 模式 | 检查内容 | 不做的动作 |
|---|---|---|
| Build | .env 完整语法、必需秘密字段、JDK/javac、Maven 实际 Java、Node/npm | 不连接业务库，不要求 Docker 引擎，不构建 |
| Environment | Build + 本机配置、禁用云/远程覆盖、Docker Linux/Compose 配置 | 不创建/停止容器，不要求管理员摘要或构建产物 |
| Simulation | Environment + 管理员 BCrypt、十个 jar / dist、业务端口归属 | 不结束未知进程，不改配置或业务状态 |

```powershell
./scripts/preflight.ps1 -Mode Environment -Json
```

JSON 包含 mode、ready 和逐项 name/ready/detail；失败退出 1，成功退出 0。报告不输出配置值、秘密或原始异常。加载器拒绝重复键、未闭合引号和非法行，先完整解析再加载；调用者已设置的变量仍优先，预检结束恢复调用者环境。dev.ps1 Build/Run 复用 Build 预检，Check 使用 Environment。

Simulation 模式按本地标准端口检查，不将自定义远程地址或其他工作区服务当作本环境健康。故障先修指定项，再执行预检；不要为了通过检查清空原数据。普通 Start 仍保留已有归属及支付台账验证。

## 同机干净目录验收

```powershell
# 普通已提交的 checkout 可直接运行；有跟踪修改时先审阅并暂存要验收的变更。
./scripts/clean-check.ps1
# 额外做独立空环境运行验收；会暂停当前健康的常驻模拟环境：
./scripts/clean-check.ps1 -Runtime
```

入口从 Git 索引写出可复核的 tree，再用 git archive 导出含空格的新目录。拒绝未暂存的跟踪修改，不复制 .env、.tools、.data、node_modules、dist 或 target。工具安装必须在源码目录之外；Maven/npm 的机器依赖缓存可以复用。随后新 setup、新前后端构建/Java 测试、npm ci 和 lint；不借用旧 jar 或前端产物。

Runtime 要求当前常驻模拟环境健康，启动前记录其模式。新目录生成自己的秘密、管理员夹具和模拟密钥，使用随机 gulimall-handoff-<32位编号> 项目、独立网络及六个新卷。暂停原服务和容器后复用本机端口；从空库初始化，接口级验证检索、注册、地址、购物车、服务端下单、SDK/RSA2 模拟付款、扣库、发货、收货和未付取消。不会启动浏览器，也不把本阶段当作新的浏览器兼容证据。

随后整套停止/重启，复核完成/取消订单、库存与持久台账。结束时停止新目录托管进程，验证资源归属并仅清理本次创建的容器/卷；原数据库、图片、密钥和台账不覆盖。成功和失败都恢复原环境，重新 Diagnose。若清理或恢复失败，命令必须失败，不把交易场景成功等同于整体验收通过。

运行日志、导出源码、独立私有配置及 result.json 留在 `.tools/clean <编号>/`，不要公开上传。result 记录 tree、构建/运行/清理/恢复结果和待补的独立机器/第二人标志；失败需结合对应 build/preflight/runtime 日志判断。重复运行不会清理历史导出目录；完成交接且无需追溯后，操作者可按实际绝对路径单独归档。

该入口不是 Demo 备份恢复工具，不读取人工演示凭据，也不放宽 _test 保护。ProjectName 参数仅供有匹配工作区归属文件的 clean-check 项目使用，日常 Start 无需传它。

## 待补验清单

- [ ] 第二位操作者在独立 Windows 机器从克隆、配置、构建完成启动。
- [ ] 由该操作者按交接表完成成功、取消、停止重启并核对订单/库存。
- [ ] 记录机器与工具版本、阻塞、私有证据位置，不提交密码或密钥。

上述待补不阻塞本机开发，但不得标为已完成。Edge/其他浏览器是阶段 19；Demo 完整隔离恢复是阶段 20。真实第三方、公网、实体设备、容量、高可用和在线热备继续不在本阶段验收范围。

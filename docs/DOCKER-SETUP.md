# 本机 Docker 安装检查点

记录日期：2026-10-24。此文件记录当前开发电脑的配置，不是其他机器的默认安装路径。

## 已完成

- Windows 11 家庭版，64 位；16 GB 内存；固件虚拟化已开启。
- Docker Desktop **4.96.3**，当前用户安装，安装程序退出码 **0**。
- 安装目录：`C:\Users\w\AppData\Local\Programs\DockerDesktop`。
- Docker 客户端 **29.9.2**、Compose **5.6.1** 均已执行验证。
- WSL **3.0.3** 安装成功，默认版本设置为 **2**。
- 启用 `VirtualMachinePlatform`，安装明确返回 `RestartNeeded=true`。
- Docker 后端选择 WSL 2；安装程序已将 CLI 加入当前用户 PATH。
- 新建 `C:\Users\w\.wslconfig`：WSL 内存上限 6 GB、CPU 4 核、交换空间 2 GB。
- Docker 与 WSL 安装包均从官方来源下载，并验证有效的 Docker Inc / Microsoft Corporation 签名。

2026-10-24 已重启，HypervisorPresent=True；Docker Linux 引擎和全部基础设施容器已运行，阶段 0 的真实 SQL、九服务注册、网关访问和持久化验收已通过。以下保留启动操作说明。

## 重启后继续

1. 保存工作并重启 Windows，使虚拟机平台组件生效。
2. 打开 Docker Desktop，等待 Linux 引擎就绪。若没有自动启动，可从开始菜单打开。
3. 在项目根目录的新 PowerShell 中执行：

```powershell
cd D:\GuliMall
# 仅为当前终端载入已准备的 JDK 8、Maven、Node/npm、Docker 和 .env；不改系统 Java。
. ./.tools/enter-dev.ps1
docker info
./scripts/dev.ps1 Check
./scripts/dev.ps1 Up
```

本机的 `.tools/enter-dev.ps1` 复用现有 IDEA Maven 和项目内隔离的工具，不随 Git 分发。该脚本只在此机器的工具路径仍存在时适用。

4. 依照 [DEVELOPMENT.md](DEVELOPMENT.md) 启动全部业务服务，检查 Nacos 注册并执行 Smoke。
5. 实际验证 SQL 初始化、演示数据及数据库/Redis/上传目录重启后持久化；不得删除数据卷来让检查通过。
6. 阶段 0 和阶段 1 均已通过，最新结果见 [implementation-plan.md](implementation-plan.md)，无需重新初始化或安装 Docker。

若重启后 `docker info` 仍失败，应先检查 `wsl --status`、`wsl --version` 和 Docker Desktop 诊断结果，不能将 CLI 版本输出当作引擎已运行。

## 安装日志

本地日志位于被 Git 忽略的目录：

- `.tools/installers/docker-install-state.json`
- `.tools/installers/wsl-install-state.json`
- `.tools/installers/wsl-feature-install.log`
- `.tools/installers/wsl-msi-install.log`
- Docker 安装日志：`C:\Users\w\AppData\Local\Docker\install-log.txt`

官方参考：[Docker Windows 安装](https://docs.docker.com/desktop/setup/install/windows-install/)、[Microsoft WSL 安装](https://learn.microsoft.com/en-us/windows/wsl/install)。

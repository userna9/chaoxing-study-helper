# 参与开发

使用 Node.js 22 或更新版本。运行 `npm ci --ignore-scripts` 安装测试依赖。

请在 `src/` 中修改模块，运行 `npm run build` 更新安装文件，再运行 `npm test` 与 `npm run check:package`。提交源码和对应的 `dist/`，不要提交 `node_modules/`、本机配置或测试报告目录。

涉及播放器、异步任务、持久存储或提交操作的变更，应补充能验证实际行为的回归场景。测试使用模拟题目、账号和接口，不要引入真实密钥或课程令牌。

版本号只在 `package.json` 中修改，再重新构建。保持 `test/fixtures/metadata.json` 中的脚本身份稳定，避免用户升级后形成多个油猴条目。

反馈问题时请说明脚本版本、浏览器、复现步骤和脱敏日志。涉及密钥或隐私的内容不要发到公开 Issue。

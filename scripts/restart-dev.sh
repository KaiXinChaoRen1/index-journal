#!/usr/bin/env bash
# 使用 bash 解释器运行此脚本。
set -euo pipefail
# 开启严格模式：遇到错误立即退出、未定义变量报错、管道任一失败即失败。

PORT=3000
# 指定开发服务默认使用的端口。
HOST="0.0.0.0"
# 指定开发服务默认监听的地址。
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 计算项目根目录，确保从任何位置执行都能定位到仓库目录。

echo "🔍 正在检查 ${HOST}:${PORT} 的监听进程..."
# 输出当前正在执行的检查动作。

LISTEN_OUTPUT="$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN || true)"
# 查询当前端口监听者；如果没有结果也不让脚本报错退出。

if [[ -z "${LISTEN_OUTPUT}" ]]; then
  # 如果没有任何进程占用该端口。
  echo "✅ 端口 ${PORT} 未被占用，准备直接启动开发服务。"
  # 提示将直接启动开发服务。
else
  # 如果检测到端口已被占用。
  PID="$(echo "${LISTEN_OUTPUT}" | awk 'NR==2 {print $2}')"
  # 从 lsof 第二行提取占用端口的进程 PID。
  COMMAND_NAME="$(echo "${LISTEN_OUTPUT}" | awk 'NR==2 {print $1}')"
  # 从 lsof 第二行提取进程名。
  COMMAND_LINE="$(ps -p "${PID}" -o command= 2>/dev/null || true)"
  # 使用 ps 获取完整命令行，便于更精确判断。
  PROCESS_CWD="$(lsof -a -p "${PID}" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)"
  # 查询该进程的工作目录，用于判断是否属于当前项目。

  echo "ℹ️ 发现占用端口的进程: PID=${PID}, NAME=${COMMAND_NAME}"
  # 打印占用者的 PID 和进程名。
  echo "ℹ️ 命令行: ${COMMAND_LINE:-<unknown>}"
  # 打印占用者的完整命令行。
  echo "ℹ️ 工作目录: ${PROCESS_CWD:-<unknown>}"
  # 打印占用者的工作目录。

  IS_NEXT_PROCESS=0
  # 初始化标记：默认不是 Next.js 开发进程。
  IS_SAME_PROJECT=0
  # 初始化标记：默认不属于当前项目目录。

  if [[ "${COMMAND_NAME}" == "node" ]] || [[ "${COMMAND_LINE}" == *"next"* ]] || [[ "${COMMAND_LINE}" == *"next-server"* ]]; then
    # 只要命令特征看起来是 Next.js 相关，就先标记为可能的 Next 进程。
    IS_NEXT_PROCESS=1
    # 更新标记为 Next.js 相关进程。
  fi
  # 结束 Next.js 相关判断。

  if [[ -n "${PROCESS_CWD}" ]] && [[ "${PROCESS_CWD}" == "${PROJECT_DIR}" ]]; then
    # 只有工作目录明确等于当前项目根目录时，才视为当前项目进程。
    IS_SAME_PROJECT=1
    # 更新标记为当前项目进程。
  fi
  # 结束同项目判断。

  if [[ "${IS_NEXT_PROCESS}" -eq 1 ]] && [[ "${IS_SAME_PROJECT}" -eq 1 ]]; then
    # 仅当它是当前项目的 Next 进程时才自动杀掉。
    echo "🧹 检测到这是当前项目的开发服务，准备停止旧进程..."
    # 提示即将停止旧进程。
    kill "${PID}"
    # 发送默认 TERM 信号，优雅终止旧服务。
    sleep 1
    # 稍等一会儿，给系统时间释放端口。
    echo "✅ 旧进程已停止。"
    # 提示停止完成。
  else
    # 如果占用者不是当前项目进程，则不做破坏性操作。
    echo "⚠️ 端口 ${PORT} 被其他程序占用，已按你的要求不自动杀掉。"
    # 提示检测到外部占用且不会自动处理。
    echo "⚠️ 请你确认后自行处理该进程，再重新执行本脚本。"
    # 引导用户手动决策后再重启。
    exit 1
    # 返回非零状态，明确告诉调用方本次未启动服务。
  fi
  # 结束占用端口时的分支处理。
fi
# 结束端口占用检查总分支。

echo "🚀 正在启动开发服务（前台模式，Ctrl+C 可直接退出）..."
# 提示即将以前台模式启动服务。
cd "${PROJECT_DIR}"
# 切换到项目根目录，避免在其他目录下执行失败。
exec npm run dev
# 使用 exec 接管当前进程；这样 Ctrl+C 会直接作用到开发服务并退出。

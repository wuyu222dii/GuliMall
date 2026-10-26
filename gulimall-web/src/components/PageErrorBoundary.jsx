import { Component } from 'react'

export default class PageErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="container catalog-page" role="alert"><h1>页面暂时无法显示</h1><p>原有购物车和订单请求已保留。请重新加载后查询原操作结果。</p><div className="admin-toolbar"><button className="btn btn-primary" onClick={() => window.location.reload()}>重新加载</button><a className="btn btn-outline" href="/">返回首页</a></div></main>
    return this.props.children
  }
}

PageErrorBoundary.propTypes = { children: () => null }

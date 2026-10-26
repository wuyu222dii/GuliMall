import { orderStatuses } from '../utils/payment'
import { orderAttributes, orderTime } from '../utils/order'

export default function OrderDetails({ detail }) {
  const { order, items, history } = detail
  return <div className="order-details">
    <h3>收货地址</h3><p>{order.receiverName} · {order.receiverPhone}</p><p>{order.receiverProvince} {order.receiverCity} {order.receiverRegion} {order.receiverDetailAddress}</p>
    <h3>商品与金额</h3>{items.map((item) => <p key={item.id}>{item.skuName} {item.skuAttrsVals && `(${orderAttributes(item.skuAttrsVals)})`} × {item.skuQuantity} — ¥{Number(item.realAmount).toFixed(2)}</p>)}
    <p>商品 ¥{Number(order.totalAmount).toFixed(2)} · 运费 ¥{Number(order.freightAmount || 0).toFixed(2)} · 应付 ¥{Number(order.payAmount).toFixed(2)}</p>
    <h3>物流信息</h3>{order.deliverySn ? <><p>Carrier: {order.deliveryCompany} · 运单号： {order.deliverySn}</p><p>Shipped: {orderTime(order.deliveryTime)}{order.receiveTime && ` · Received: ${orderTime(order.receiveTime)}`}</p></> : <p>尚未发货。</p>}
    <p>{[2, 3].includes(order.status) ? order.status === 3 ? '已确认收货，订单完成。' : '订单已发货，收到包裹后再确认收货。' : order.status === 4 ? order.inventoryStatus === 2 ? '订单已关闭，库存已释放。' : '订单已关闭，等待库存释放。' : order.status === 8 ? '付款关闭结果尚未确认，库存继续锁定。' : order.fulfillmentReady ? '付款和库存均已确认，等待发货。' : order.inventoryStatus === 2 ? '库存已释放，禁止发货。' : '付款和库存处理确认前不能发货。'}</p>
    <h3>订单历史</h3><ol className="order-history">{history.map((entry) => <li key={entry.id}><time dateTime={entry.createTime}>{orderTime(entry.createTime)}</time> · {orderStatuses[entry.orderStatus] || '未知状态'} · {entry.note}</li>)}</ol>
  </div>
}

OrderDetails.propTypes = {
  detail(props, name) {
    const detail = props[name]
    return detail?.order && Array.isArray(detail.items) && Array.isArray(detail.history)
      ? null : new Error('OrderDetails requires an order snapshot, items and history.')
  },
}

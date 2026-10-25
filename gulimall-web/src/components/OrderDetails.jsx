import { orderStatuses } from '../utils/payment'
import { orderAttributes, orderTime } from '../utils/order'

export default function OrderDetails({ detail }) {
  const { order, items, history } = detail
  return <div className="order-details">
    <h3>Shipping address</h3><p>{order.receiverName} · {order.receiverPhone}</p><p>{order.receiverProvince} {order.receiverCity} {order.receiverRegion} {order.receiverDetailAddress}</p>
    <h3>Items and amount</h3>{items.map((item) => <p key={item.id}>{item.skuName} {item.skuAttrsVals && `(${orderAttributes(item.skuAttrsVals)})`} × {item.skuQuantity} — ¥{Number(item.realAmount).toFixed(2)}</p>)}
    <p>Items ¥{Number(order.totalAmount).toFixed(2)} · Freight ¥{Number(order.freightAmount || 0).toFixed(2)} · Total ¥{Number(order.payAmount).toFixed(2)}</p>
    <h3>Delivery</h3>{order.deliverySn ? <><p>Carrier: {order.deliveryCompany} · Tracking No.: {order.deliverySn}</p><p>Shipped: {orderTime(order.deliveryTime)}{order.receiveTime && ` · Received: ${orderTime(order.receiveTime)}`}</p></> : <p>Not shipped yet.</p>}
    <p>{[2, 3].includes(order.status) ? order.status === 3 ? 'Receipt confirmed. Order completed.' : 'Order shipped. Confirm receipt after the package arrives.' : order.status === 4 ? order.inventoryStatus === 2 ? 'Order closed. Inventory released.' : 'Order closed. Inventory release is pending.' : order.status === 8 ? 'Payment closure is not confirmed. Inventory stays reserved.' : order.fulfillmentReady ? 'Payment and inventory confirmed. Awaiting shipment.' : order.inventoryStatus === 2 ? 'Inventory released. Shipping is blocked.' : 'Shipping is blocked until payment and inventory are confirmed.'}</p>
    <h3>Order history</h3><ol className="order-history">{history.map((entry) => <li key={entry.id}><time dateTime={entry.createTime}>{orderTime(entry.createTime)}</time> · {orderStatuses[entry.orderStatus] || 'Unknown'} · {entry.note}</li>)}</ol>
  </div>
}

OrderDetails.propTypes = {
  detail(props, name) {
    const detail = props[name]
    return detail?.order && Array.isArray(detail.items) && Array.isArray(detail.history)
      ? null : new Error('OrderDetails requires an order snapshot, items and history.')
  },
}

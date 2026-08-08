import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import api from '../api/axios';
import { formatINR } from '../utils/format';

const STEP_LABELS = { pending: 'Placed', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered' };

function TrackingBar({ order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
        <XCircle size={16} /> Cancelled
      </div>
    );
  }
  return (
    <div className="flex items-center">
      {order.trackingSteps.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            {i <= order.currentStepIndex ? (
              <CheckCircle2 size={18} className="text-brand-600" />
            ) : (
              <Circle size={18} className="text-gray-300" />
            )}
            <span className={`text-[11px] mt-1 ${i <= order.currentStepIndex ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>
              {STEP_LABELS[step]}
            </span>
          </div>
          {i < order.trackingSteps.length - 1 && (
            <div className={`h-0.5 w-10 sm:w-16 mb-4 ${i < order.currentStepIndex ? 'bg-brand-600' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/orders/mine').then((res) => setOrders(res.data.orders)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this order?')) return;
    await api.patch(`/orders/${id}/cancel`);
    load();
  };

  if (loading) return <div className="text-center py-24 text-gray-400">Loading your orders…</div>;

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-gray-900">No orders yet</h1>
        <p className="text-gray-500 mt-2">Once you place an order, you can track it here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-gray-900 mb-8">Your Orders</h1>
      <div className="space-y-5">
        {orders.map((order) => (
          <div key={order.id} className="rounded-xl border border-gray-100 bg-white p-6">
            <div className="flex flex-wrap justify-between gap-4 mb-5">
              <div>
                <p className="text-xs text-gray-400">Order #{order.id.slice(0, 8)}</p>
                <p className="font-semibold text-gray-900">{order.vendor_name}</p>
                <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-semibold text-lg">{formatINR(order.total_amount)}</p>
                {['pending', 'confirmed'].includes(order.status) && (
                  <button onClick={() => cancel(order.id)} className="text-xs text-red-500 hover:underline mt-1">Cancel order</button>
                )}
              </div>
            </div>

            <TrackingBar order={order} />

            <div className="mt-5 border-t border-gray-100 pt-4 space-y-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-gray-600">
                  <span>{item.product_name} × {item.quantity}</span>
                  <span>{formatINR(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react'
import { getAddressList, saveAddress, deleteAddress } from '../api/member'

const EMPTY_FORM = {
  name: '',
  phone: '',
  province: '',
  city: '',
  region: '',
  detailAddress: '',
  defaultStatus: 0,
}

export default function MemberAddress() {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const loadAddresses = async () => {
    setLoading(true)
    try {
      const res = await getAddressList({ page: 1, limit: 50 })
      if (res.code === 0) setAddresses(res.page?.list || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAddresses() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.detailAddress) {
      setError('Please fill in all required fields')
      return
    }
    setError('')
    try {
      const res = await saveAddress(form)
      if (res.code === 0) {
        setShowForm(false)
        setForm(EMPTY_FORM)
        loadAddresses()
      } else {
        setError(res.msg || 'Failed to save')
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this address?')) return
    try {
      await deleteAddress([id])
      loadAddresses()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0, border: 'none' }}>Shipping addresses</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add address'}
        </button>
      </div>

      {showForm && (
        <form className="address-form" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div className="form-group">
            <label>Recipient</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Province</label>
            <input className="input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
          </div>
          <div className="form-group">
            <label>City</label>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="form-group">
            <label>District</label>
            <input className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Street address</label>
            <input className="input" value={form.detailAddress} onChange={(e) => setForm({ ...form, detailAddress: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={form.defaultStatus === 1}
              onChange={(e) => setForm({ ...form, defaultStatus: e.target.checked ? 1 : 0 })}
            />
            Set as default address
          </label>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-primary">Save</button>
        </form>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : addresses.length > 0 ? (
        <div className="address-list">
          {addresses.map((addr) => (
            <div key={addr.id} className="address-item">
              <div>
                <strong>{addr.name}</strong> {addr.phone}
                {addr.defaultStatus === 1 && (
                  <span style={{ marginLeft: 8, color: '#e4393c', fontSize: 12 }}>[Default]</span>
                )}
                <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                  {addr.province}{addr.city}{addr.region} {addr.detailAddress}
                </div>
              </div>
              <button
                className="btn btn-outline"
                style={{ padding: '4px 12px', fontSize: 12 }}
                onClick={() => handleDelete(addr.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state card" style={{ padding: 40 }}>No shipping addresses yet</div>
      )}
    </div>
  )
}

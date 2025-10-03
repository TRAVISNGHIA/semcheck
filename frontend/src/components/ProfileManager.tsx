'use client'
import { useEffect, useState } from 'react'
import SidebarLayout from './SidebarLayout'

export default function ProfileManager() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedProfile, setEditedProfile] = useState<any>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

  const [showAddModal, setShowAddModal] = useState(false)
  const [newProfile, setNewProfile] = useState({
    name: '',
    user_data_dir: '',
    profile_directory: '',
    user_agent: '',
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    const res = await fetch(`${API_BASE_URL}/api/profiles/`)
    const data = await res.json()
    setProfiles(data)
  }

  const deleteProfile = async (id: string) => {
    await fetch(`${API_BASE_URL}/api/profiles/delete?profile_id=${id}`, { method: 'DELETE' })
    fetchProfiles()
  }

  const openEditModal = (profile: any) => {
    setEditingId(profile._id)
    setEditedProfile({ ...profile })
    setShowModal(true)
  }

  const updateProfile = async () => {
    if (!editingId) return
    const { _id, ...safeData } = editedProfile

    await fetch(`${API_BASE_URL}/api/profiles/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: editingId,
        updated_data: safeData
      }),
    })

    setShowModal(false)
    setEditingId(null)
    setEditedProfile(null)
    fetchProfiles()
  }

  const createProfile = async () => {
    if (!newProfile.name.trim()) {
      alert('Name không được để trống')
      return
    }
    await fetch(`${API_BASE_URL}/api/profiles/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProfile),
    })
    setShowAddModal(false)
    setNewProfile({ name: '', user_data_dir: '', profile_directory: '', user_agent: '' })
    fetchProfiles()
  }

  const filteredProfiles = profiles.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSearchQuery(searchTerm.trim())
  }

  return (
    <SidebarLayout>
      <section className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
        <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-black dark:text-white">Quản lý Profiles</h2>
          </div>

          {/* Search form */}
          <form
            onSubmit={handleSearch}
            className="w-full p-4 border-b border-gray-200 dark:border-gray-700"
          >
            <div className="flex gap-2 w-full">
              <input
                type="text"
                placeholder="Nhập tên profile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border px-3 py-2 rounded flex-1"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-black text-white rounded hover:bg-blue-700"
              >
                Tìm kiếm
              </button>
            </div>
          </form>

          {/* Table profiles */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">User Data Dir</th>
                  <th className="px-4 py-3">Profile Dir</th>
                  <th className="px-4 py-3 text-center w-[140px] whitespace-nowrap">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-center text-gray-500">
                      Không có profile nào
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((p, index) => (
                    <tr key={p._id} className="border-b dark:border-gray-700 text-black">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2">{p.user_data_dir}</td>
                      <td className="px-4 py-2">{p.profile_directory}</td>
                      <td className="px-4 py-2 text-center space-x-2 w-[140px] whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-blue-700 transition"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => deleteProfile(p._id)}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-red-700 transition"
                        >
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-black text-white rounded hover:bg-green-700"
            >
              Thêm Profile
            </button>
          </div>
        </div>

        {/* Modal sửa profile */}
        {showModal && editedProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Sửa Profile</h3>
              <div className="grid grid-cols-1 gap-3">
                <input
                  value={editedProfile.name}
                  onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                  className="border px-3 py-2 rounded"
                />
                <input
                  value={editedProfile.user_data_dir}
                  onChange={(e) => setEditedProfile({ ...editedProfile, user_data_dir: e.target.value })}
                  className="border px-3 py-2 rounded"
                />
                <input
                  value={editedProfile.profile_directory}
                  onChange={(e) => setEditedProfile({ ...editedProfile, profile_directory: e.target.value })}
                  className="border px-3 py-2 rounded"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Huỷ
                </button>
                <button
                  onClick={updateProfile}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal thêm profile */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl">
              <h3 className="text-lg font-bold mb-4 text-green-700">Thêm Profile Mới</h3>
              <div className="grid grid-cols-1 gap-3">
                <input
                  placeholder="Name"
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                  className="border px-3 py-2 rounded"
                />
                <input
                  placeholder="User Data Dir"
                  value={newProfile.user_data_dir}
                  onChange={(e) => setNewProfile({ ...newProfile, user_data_dir: e.target.value })}
                  className="border px-3 py-2 rounded"
                />
                <input
                  placeholder="Profile Directory"
                  value={newProfile.profile_directory}
                  onChange={(e) => setNewProfile({ ...newProfile, profile_directory: e.target.value })}
                  className="border px-3 py-2 rounded"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Huỷ
                </button>
                <button
                  onClick={createProfile}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-green-700"
                >
                  Thêm
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </SidebarLayout>
  )
}

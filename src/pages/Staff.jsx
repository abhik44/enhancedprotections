import { useEffect, useState, useMemo } from "react";
import Search from "../ui/Search";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import { HiPencilSquare } from "react-icons/hi2";
import CreateStaffModal from "./CreateStaffModal";
import { HiEye } from "react-icons/hi";
import {  useNavigate } from "react-router-dom";


function Staff() {
  const navigate = useNavigate();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");

  
  const [editingStaff, setEditingStaff] = useState(null);

  useEffect(() => {
    
    setLoading(true);

    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStaffs(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching staff:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredStaffs = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return staffs;

    const qDigits = q.replace(/\D/g, "");

    return staffs.filter((s) => {
      const first = (s.firstname || "").toLowerCase();
      const last = (s.lastname || "").toLowerCase();
      const full = `${first} ${last}`.trim();
      const email = (s.email || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      const phoneDigits = phone.replace(/\D/g, "");

      return (
        first.includes(q) ||
        last.includes(q) ||
        full.includes(q) ||
        email.includes(q) ||
        (qDigits && phoneDigits.includes(qDigits))
      );
    });
  }, [staffs, searchTerm]);

  const handleOpenCreate = () => setEditingStaff(null);

  const handleOpenEdit = (staff) => setEditingStaff(staff);

  return (
    <>
      <div className="d-flex justify-content-between gap-5 align-items-center mb-3">
        <h3 className="text-4a">Staffs</h3>

        <div className="d-flex gap-4 justify-content-end">
          <div style={{ width: "500px" }}>
            <Search
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone"
            />
          </div>

          <div>
            <button
              type="button"
              className="btn custom-red-bg text-white fw-medium"
              data-bs-toggle="modal"
              data-bs-target="#createStaff"
              onClick={handleOpenCreate}
            >
              + Create Staff
            </button>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="staffTable border border-2 rounded-4 p-3">
        {loading ? (
          <div className="text-custom-red text-center d-flex align-items-center justify-content-center gap-2">
            <Spinner colorSpinner="text-custom-red" />
            <span>Loading staff...</span>
          </div>
        ) : filteredStaffs.length === 0 ? (
          <div className="text-custom-red fw-bold text-center mb-0">
            No Staff Found :(
          </div>
        ) : (
          <table className="table">
            <thead className="table-light">
              <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Profile</th>
                <th>Edit</th>
                <th>View Document</th>
              </tr>
            </thead>

            <tbody>
              {filteredStaffs.map((staff) => (
                <tr key={staff.id}>
                  <td>{staff.firstname || "-"}</td>
                  <td>{staff.lastname || "-"}</td>
                  <td>{staff.email || "-"}</td>
                  <td>{staff.phone || "-"}</td>
              

                  <td className="ps-3">
                    
                    {staff.profilePic && (
                      <img
                        src={staff.profilePic}
                        alt="profile"
                        width="35"
                        height="35"
                        className="rounded-pill"
                        style={{ objectFit: "cover" }}
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="btn btn-link p-0 border-0 text-black"
                      data-bs-toggle="modal"
                      data-bs-target="#createStaff"
                      onClick={() => handleOpenEdit(staff)}
                    >
                      <HiPencilSquare />
                    </button>
                  </td>
                  <td className="ps-5 "  >
                    <button type="button"   className="btn btn-link p-0 border-0 text-black" onClick={() => navigate("viewStaffSignedDocuments" , {state:{staffId:staff.id}})}>
                    <HiEye/>

                    </button>
                    
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateStaffModal
        editingStaff={editingStaff}
        onClose={() => setEditingStaff(null)}
      />
    </>
  );
}

export default Staff;

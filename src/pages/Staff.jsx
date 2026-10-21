import { useEffect, useState, useMemo } from "react";
import Search from "../ui/Search";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Spinner from "../ui/Spinner";
import { HiPencilSquare, HiTrash, HiUser } from "react-icons/hi2";
import CreateStaffModal from "./CreateStaffModal";
import { HiEye } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { deleteDoc, doc } from "firebase/firestore";
import styles from "./CreateStaff.module.css";

function Staff() {
  const navigate = useNavigate();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployment, setSelectedEmployment] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingStaff, setEditingStaff] = useState(null);

  useEffect(() => {
    setLoading(true);

    const q = query(collection(db, "staff"), orderBy("firstname", "asc"));

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
      },
    );

    return () => unsubscribe();
  }, []);

  const handleDelete = async (staffId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this staff?");

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "staff", staffId));
    } catch (err) {
      console.error("Error deleting staff:", err);
      alert("Failed to delete staff");
    }
  };

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

      return first.includes(q) || last.includes(q) || full.includes(q) || email.includes(q) || (qDigits && phoneDigits.includes(qDigits));
    });
  }, [staffs, searchTerm]);

  const handleOpenCreate = () => setEditingStaff(null);
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = (date) => {
    if (!date) return "-";

    try {
      // Firestore Timestamp → JS Date
      const d = date.toDate ? date.toDate() : new Date(date);

      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "-";
    }
  };
  const handleOpenEdit = (staff) => setEditingStaff(staff);

  const getInitials = (staff) => `${(staff.firstname || "")[0] || ""}${(staff.lastname || "")[0] || ""}`.toUpperCase() || "?";

  return (
    <>
      <div className={styles.header}>
        <h3 className="text-4a mb-0">Staffs</h3>

        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name, email, phone" />
          </div>

          <div>
            <button type="button" className="btn custom-red-bg text-white fw-medium" data-bs-toggle="modal" data-bs-target="#createStaff" onClick={handleOpenCreate}>
              + Create Staff
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="staffTable border border-2 rounded-4 p-3">
          <div className="text-custom-red text-center d-flex align-items-center justify-content-center gap-2">
            <Spinner colorSpinner="text-custom-red" />
            <span>Loading staff...</span>
          </div>
        </div>
      ) : filteredStaffs.length === 0 ? (
        <div className="staffTable border border-2 rounded-4 p-3">
          <div className="text-custom-red fw-bold text-center mb-0">No Staff Found :(</div>
        </div>
      ) : (
        <>
          {/* ================= Desktop / tablet: Table ================= */}
          <div className={`${styles.desktopOnly} staffTable border border-2 rounded-4 p-3`}>
            <table className="table">
              <thead className="table-light">
                <tr>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th>Phone</th>
                  <th>Profile</th>
                  <th>Edit</th>
                  <th>View Document</th>
                  <th>Employment Details</th>
                  <th>Delete</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaffs.map((staff) => (
                  <tr key={staff.id}>
                    <td>{staff.firstname || "-"}</td>
                    <td>{staff.lastname || "-"}</td>
                    <td>{staff.email || "-"}</td>
                    <td>{staff.password || "-"}</td>

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
                    <td className="ps-5 ">
                      <button type="button" className="btn btn-link p-0 border-0 text-black" onClick={() => navigate("viewStaffSignedDocuments", { state: { staffId: staff.id } })}>
                        <HiEye />
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-link p-0 border-0 text-black" data-bs-toggle="modal" data-bs-target="#employmentModal" onClick={() => setSelectedEmployment(staff)}>
                        <HiEye />
                      </button>
                    </td>

                    <td>
                      <button className="btn btn-link text-danger  p-0 border-0" onClick={() => handleDelete(staff.id)}>
                        <HiTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ================= Mobile: Cards ================= */}
          <div className={`${styles.mobileOnly} ${styles.cardList}`}>
            {filteredStaffs.map((staff) => (
              <div className={styles.card} key={staff.id}>
                {/* Top row: avatar + name on the left, action icons on the right */}
                <div className={styles.cardTop}>
                  <div className={styles.identity}>
                    {staff.profilePic ? (
                      <img src={staff.profilePic} alt="profile" className={styles.avatar} onError={(e) => (e.currentTarget.style.display = "none")} />
                    ) : (
                      <div className={styles.avatarFallback}>{getInitials(staff)}</div>
                    )}
                    <h6 className={styles.name}>{`${staff.firstname || ""} ${staff.lastname || ""}`.trim() || "-"}</h6>
                  </div>

                  <div className={styles.cardActions}>
                    <button type="button" className={styles.iconBtn} title="Edit" aria-label="Edit staff" data-bs-toggle="modal" data-bs-target="#createStaff" onClick={() => handleOpenEdit(staff)}>
                      <HiPencilSquare />
                    </button>

                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="View documents"
                      aria-label="View signed documents"
                      onClick={() => navigate("viewStaffSignedDocuments", { state: { staffId: staff.id } })}
                    >
                      <HiEye />
                    </button>

                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Employment details"
                      aria-label="View employment details"
                      data-bs-toggle="modal"
                      data-bs-target="#employmentModal"
                      onClick={() => setSelectedEmployment(staff)}
                    >
                      <HiUser />
                    </button>

                    <button type="button" className={styles.iconBtnDanger} title="Delete" aria-label="Delete staff" onClick={() => handleDelete(staff.id)}>
                      <HiTrash />
                    </button>
                  </div>
                </div>

                {/* Details: full width under the header row */}
                <dl className={styles.details}>
                  <dt>Email</dt>
                  <dd>{staff.email || "-"}</dd>
                  <dt>Phone</dt>
                  <dd>{staff.phone || "-"}</dd>
                  <dt>Password</dt>
                  <dd>{staff.password || "-"}</dd>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="modal fade" id="employmentModal" tabIndex="-1">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Employment Details</h5>
              <button className="btn-close" data-bs-dismiss="modal"></button>
            </div>

            <div className="modal-body">
              {selectedEmployment?.employmentDetails ? (
                <div className="row">
                  <h4 className="fw-bold mb-3">Personal Details</h4>

                  <p>
                    <strong>Name:</strong> {selectedEmployment.employmentDetails.firstName} {selectedEmployment.employmentDetails.lastName}
                  </p>
                  <p>
                    <strong>Gender:</strong> {selectedEmployment.employmentDetails.gender}
                  </p>
                  <p>
                    <strong>DOB:</strong> {formatDate(selectedEmployment.employmentDetails.dob)}
                  </p>
                  <p>
                    <strong>Start Date:</strong> {formatDate(selectedEmployment.employmentDetails.startDate)}
                  </p>
                  <p>
                    <strong>Tax File:</strong> {selectedEmployment.employmentDetails.taxFile}
                  </p>

                  <hr />

                  <h4 className="fw-bold mb-3">Contact</h4>
                  <p>
                    <strong>Address:</strong> {selectedEmployment.employmentDetails.address}
                  </p>
                  <p>
                    <strong>Suburb:</strong> {selectedEmployment.employmentDetails.suburb}
                  </p>
                  <p>
                    <strong>State:</strong> {selectedEmployment.employmentDetails.state}
                  </p>
                  <p>
                    <strong>Postcode:</strong> {selectedEmployment.employmentDetails.postcode}
                  </p>
                  <p>
                    <strong>Mobile:</strong> {selectedEmployment.employmentDetails.mobile}
                  </p>
                  <p>
                    <strong>Home Phone:</strong> {selectedEmployment.employmentDetails.homePhone}
                  </p>

                  <hr />

                  <p>
                    <strong>Claim tax free threshold:</strong> {selectedEmployment.employmentDetails.claimtax}
                  </p>

                  <hr />

                  <h4 className="fw-bold mb-3">Bank</h4>
                  <p>
                    <strong>Bank:</strong> {selectedEmployment.employmentDetails.bank}
                  </p>
                  <p>
                    <strong>Branch:</strong> {selectedEmployment.employmentDetails.branch}
                  </p>
                  <p>
                    <strong>Account Name:</strong> {selectedEmployment.employmentDetails.accountName}
                  </p>
                  <p>
                    <strong>BSB:</strong> {selectedEmployment.employmentDetails.bsb}
                  </p>
                  <p>
                    <strong>Account Number:</strong> {selectedEmployment.employmentDetails.accountNumber}
                  </p>

                  <hr />

                  <h4 className="fw-bold mb-3">Superannuation</h4>
                  <p>
                    <strong>Fund:</strong> {selectedEmployment.employmentDetails.superFund}
                  </p>
                  <p>
                    <strong>Member No:</strong> {selectedEmployment.employmentDetails.memberNumber}
                  </p>
                  <p>
                    <strong>Employer Contribution:</strong> {selectedEmployment.employmentDetails.employerContribution}
                  </p>

                  <hr />

                  <h4 className="fw-bold mb-3">Licence Details</h4>
                  <p>
                    <strong>RSA Number:</strong> {selectedEmployment.employmentDetails.rsaNumber}
                  </p>
                  <p>
                    <strong>Security Licence Number:</strong> {selectedEmployment.employmentDetails.securityLicenceNumber}
                  </p>
                  <p>
                    <strong>First Aid Number:</strong> {selectedEmployment.employmentDetails.firstAidNumber}
                  </p>

                  <hr />

                  <p className="text-muted">
                    <strong>Last Updated:</strong> {formatDateTime(selectedEmployment.employmentDetails.updatedAt)}
                  </p>
                </div>
              ) : (
                <p>No employment details found.</p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <CreateStaffModal editingStaff={editingStaff} onClose={() => setEditingStaff(null)} />
    </>
  );
}

export default Staff;
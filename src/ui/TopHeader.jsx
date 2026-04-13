import { FaArrowRightFromBracket } from "react-icons/fa6"
import styles from "./TopHeader.module.css"
import { getAuth , signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function TopHeader() {
    const navigate = useNavigate();

    async function handleLogOut() {

        try{
            const auth = getAuth();
            await signOut (auth);
            toast.success("Logged Out");
            navigate("/");
        }catch(err){
            console.error("Logout error" , err);
            toast.error("Failed to logout");
        }
        
    }

    return (
        <div className={styles.topHeader}>
            <h5 className="mb-0">Welcome , Admin</h5>

          <div className='d-flex'>
                <button className={`fw-semibold ${styles.logout}`} onClick={handleLogOut}  >
                    <FaArrowRightFromBracket/>
                    Log Out
                </button>

            </div>
        </div>
    )
}

export default TopHeader

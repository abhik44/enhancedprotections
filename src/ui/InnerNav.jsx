import styles from "./InnerNav.module.css";
import { NavLink } from "react-router-dom";
import { FaClock, FaFileInvoiceDollar, FaMapPin, FaUsers } from "react-icons/fa6";
import { FaFileAlt } from "react-icons/fa";

function InnerNav() {
  return (
    <div className={styles.myNav}>
      <ul className={styles.mynavlist}>
        <li>
          <NavLink className={styles.myLink} to="staff">
            <FaUsers />
            <span>Staffs</span>
          </NavLink>
        </li>
        <li>
          <NavLink className={styles.myLink} to="shift">
            <FaClock />
            <span>Shifts</span>
          </NavLink>
        </li>
        <li>
          <NavLink className={styles.myLink} to="venue-timesheet">
            <FaFileInvoiceDollar />
            <span>Venue Timesheet</span>
          </NavLink>
        </li>

        <li>
          <NavLink className={styles.myLink} to="site">
            <FaMapPin />
            <span>Sites</span>
          </NavLink>
        </li>

        <li>
          <NavLink className={styles.myLink} to="site-documents">
            <FaFileAlt />
            <span>Site Documents</span>
          </NavLink>
        </li>

        <li>
          <NavLink className={styles.myLink} to="document">
            <FaFileAlt />
            <span>Documents</span>
          </NavLink>
        </li>
      </ul>
    </div>
  );
}

export default InnerNav;

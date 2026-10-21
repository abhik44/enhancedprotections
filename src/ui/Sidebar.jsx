// import InnerNav from './InnerNav'

// import styles from './Sidebar.module.css'

// function Sidebar() {
//     return (
//         <div className={styles.sidebar}>

//             <div className='text-center' > 
//      <img src="/logo.png" alt="" className={styles.sidebarlogo} />
//             </div>
            
//             <div className={styles.innerNavDiv}>

//                 <InnerNav/>
//             </div>
//         </div>
//     )
// }

// export default Sidebar


import { useState } from "react";
import InnerNav from "./InnerNav";
import styles from "./Sidebar.module.css";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className={styles.mobileHeader}>
        <img src="/logo.png" alt="Logo" />

        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isOpen}
          aria-controls="sidebar-navigation"
        >
          {isOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className={styles.overlay}
          onClick={closeMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-navigation"
        className={`${styles.sidebar} ${
          isOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.logoContainer}>
          <img src="/logo.png" alt="Logo" className={styles.sidebarlogo} />
        </div>

        <div className={styles.innerNavDiv}>
          <InnerNav onNavigate={closeMenu} />
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
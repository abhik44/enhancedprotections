import { Outlet } from "react-router-dom"
import styles from "./AppLayout.module.css"
import Sidebar from "./Sidebar"
import TopHeader from "./TopHeader"
function AppLayout() {
    return (
        <div className={styles.appLayout}>
          {/* sidebar */}
        <Sidebar/>
          {/* top header */}
          <TopHeader/>

          {/* main */}
          <main className={styles.main}>
            <div className={styles.myContainer}>
                <Outlet/>

            </div>

          </main>

        </div>
    )
}

export default AppLayout

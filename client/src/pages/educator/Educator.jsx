import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../../components/educator/Navbar'
import SideBar from '../../components/educator/Sidebar'
import Footer from '../../components/educator/Footer'
const Educator = () => {
  return (
    <div className='text-default bg-white min-h-screen'>
       <Navbar />
      <div className='flex'>
        <SideBar />
        <div>
        {<Outlet/>}
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default Educator

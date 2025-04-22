import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import CourseCard from './CourseCard'
import { AppContext } from '../../context/AppContext'

const CourceSection = () => {
  const{allCourses} = useContext(AppContext)
  return (
    <div className='py-16 md:px-40 px-8 '>
      <h2 className='text-3xl font-medium text-gray-700'>Learn from the best</h2>
      <p className='text-sm md:text-base text-gray-500 mt-3'>Our courses are designed to help you learn from the best in the industry. Our instructors are more than just teachers - they're professionals with real-world experience.</p>
      
      <div className='grid grid-cols-auto gap-4 px-4 my-10 md:py-16 md:px-0 '>
        {allCourses.slice(0,4).map((course,index)=><CourseCard key={index} course={course} />)}
      </div>
      <Link to={'/course-list'} onClick={()=> scrollTo(0,0)} className='text-gray-500 border border-gray-500/30 px-10 py-3 rounded'
      >View All Courses </Link>

    </div>
  )
}

export default CourceSection

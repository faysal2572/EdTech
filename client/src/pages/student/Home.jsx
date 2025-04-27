import React from 'react'
import Hero from '../../components/student/hero'
import Companies from '../../components/student/companies'
import CourceSection from '../../components/student/CourceSection'
import TestimonialsSection from '../../components/student/TestimonialsSection'
import CallToAction from '../../components/student/CallToAction'
import Footer from '../../components/student/footer'

const Home = () => {
  return (
    <div className='flex flex-col items-center justify-center space-y-7 text-center'>
      <Hero />
      <Companies />
      <CourceSection />
      <TestimonialsSection />
      <CallToAction/>
      <Footer/>
    </div>
  )
}

export default Home

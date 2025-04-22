import React from 'react'
import { assets, dummyTestimonial } from '../../assets/assets'

const TestimonialsSection = () => {
  return (
    <div className=' pb=14 px-8 md:px-12'>
      <h2 className='text-3xl font-medium text-gray-700'>Testimonial</h2>
      <p className='md:text-base text-gray-500 mt-3'>From our learners as they share thei journey of transformation,success and how our<br /> courses have impacted their lives.</p>
      <div className='flex grid-col md:flex-row gap-5 mt-10'>
        {dummyTestimonial.map((testimonial, index) => (
          <div key={index} className='text-sm text-left border border-gray-500/40 pb-6 rounded-lg bg-white shadow-md mt-2 oveerflow-hidden'>
            <div className='flex items-center gap-4 px-5 py-5 bg-gray-500/10'>
              <img className='h-12 w-12 rounded-full' src={testimonial.image} alt={testimonial.name} />
              <div>
                <h1 className='text-lg font-medium text-gray-900'>{testimonial.name}</h1>
                <p className='text-gray-800/80'>{testimonial.role}</p>
              </div>
            </div> 
            <div className='p-5 pb-7'>
                <div className='flex gap-0.5'>
                  {[...Array(5)].map((_,i) => (
                    <img className='h-5' key={i} src={i < Math.floor(testimonial.rating) ? assets.star : assets.star_blank}  alt='star'/>
                  ))}
                </div>
                <p className='text-gray-500 mt-5'>{testimonial.feedback}</p>
              </div>
              <a href='#' className='text-blue-500 underline px-5' > Read More</a>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TestimonialsSection

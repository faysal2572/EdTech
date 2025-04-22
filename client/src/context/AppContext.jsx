import { createContext, useEffect, useState} from "react";
import { dummyCourses } from "../assets/assets";
import { useNavigate } from "react-router-dom";
export const AppContext = createContext()
export const AppContextProvider = (props)=>{
    const currency =import.meta.env.VITE_CURRENCY  
    const navigate= useNavigate() 
    const [allCourses,setallCourses] = useState([])
    const [isEducator,setisEducator] = useState(true)


    //fetch all courses
    const  fetchALLCourses = async()=>{
        setallCourses(dummyCourses)
    }
    // function to calculate average rating
    const calculateRating = (course) => {
        if(course.courseRatings.length === 0){
            return 0
            };
        let totalRating = 0 
        course.courseRatings.forEach(rating =>{
            return totalRating + rating.rating
        })
        return totalRating/course.courseRatings.length
            
        }
    useEffect(()=>{
        fetchALLCourses()
    },[])
    const value = {
        currency , allCourses, navigate , calculateRating ,isEducator, setisEducator 
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}

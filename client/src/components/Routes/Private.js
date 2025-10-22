import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/auth";
import { Outlet, Navigate } from "react-router-dom";
import axios from "axios";
import Spinner from "../Spinner";

export default function PrivateRoute() {
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auth] = useAuth();

  useEffect(() => {
    let isMounted = true;
    let timer;

    const authCheck = async () => {
      try {
        const res = await axios.get("/api/v1/auth/user-auth");
        if (isMounted) {
          setOk(res.data.ok);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setOk(false);
          setLoading(false);
        }
      }
    };

    if (auth?.token) {
      authCheck();
    } else {
      // Give AuthProvider a chance to load from localStorage before deciding to redirect
      timer = setTimeout(() => {
        if (isMounted && !auth?.token) {
          setOk(false);
          setLoading(false);
        }
      }, 50);
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [auth?.token]);

  // show spinner while loading, then redirect to login if not authenticated
  if (loading) {
    return <Spinner />;
  }

  return ok ? <Outlet /> : <Navigate to="/login" />;
}

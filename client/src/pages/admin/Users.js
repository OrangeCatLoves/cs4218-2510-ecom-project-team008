import React, {useState, useEffect} from 'react'
import Layout from '../../components/Layout';
import AdminMenu from '../../components/AdminMenu';
import axios from "axios";
import toast from "react-hot-toast";

const Users = () => {
  const [users, setUsers] = useState([]);

  const getAllUsers = async () => {
    try {
      const { data } = await axios.get("/api/v1/auth/all-users");
      setUsers(data);
    } catch (error) {
      console.log(error);
      toast.error("Something Went Wrong");
    }
  };

  useEffect(() => {
    getAllUsers();
  }, []);

  return (
    <Layout title={"Dashboard - All Users"}>
      <div className="container-fluid m-3 p-3">
        <div className="row">
          <div className="col-md-3">
            <AdminMenu/>
          </div>
          <div className="col-md-9">
            <h1>All Users</h1>
            <ol>
              {users.map((user) => (
                <li key={user._id}>{user.name}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Users;
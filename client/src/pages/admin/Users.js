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
            <div className="grid grid-cols-6 gap-2">
              {users.map((user) => (
                <div key={user._id}>
                  <h2 data-testid="username">{`${user.name}${user.role === 1 ? "(Admin)" : ""}`}</h2>
                  <p data-testid="email">{`Email: ${user.email}`}</p>
                  <p data-testid="phone">{`Phone: ${user.phone}`}</p>
                  <p data-testid="address">{`Address: ${user.address}`}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Users;
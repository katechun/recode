package api

import (
	"net/http"
)

// 空的实现以避免编译错误
func GetAccounts(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func GetStatistics(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func AddAccount(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func GetAccountTypes(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func GetStores(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func Login(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func GetUsers(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func AddUser(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusNotImplemented, 501, "API未实现", nil)
}

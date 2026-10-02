const API_URL =
    "https://script.google.com/macros/s/AKfycbx9DYeYprPswuwdMWnXZjRo9lkUDhn076zb2ifvUMIE77zyyeEFxPMk58ngBp--9FU5/exec";


const form = document.getElementById("pollForm");
const submitButton = document.getElementById("submitButton");
const message = document.getElementById("message");

const results = document.getElementById("results");
const resultList = document.getElementById("resultList");


form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const checked =
        document.querySelectorAll(
            'input[type="checkbox"]:checked'
        );

    const selected =
        Array.from(checked).map(
            checkbox => checkbox.value
        );


    if (selected.length === 0) {

        message.textContent =
            "请至少选择一个选项。";

        return;
    }


    submitButton.disabled = true;
    submitButton.textContent = "提交中...";


    try {

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },

            body: JSON.stringify({
                selected: selected
            })

        });


        const data = await response.json();


        if (!data.success) {

            message.textContent =
                data.message || "提交失败";

            submitButton.disabled = false;
            submitButton.textContent = "提交投票";

            return;
        }


        // 提交成功
        message.textContent =
            "投票已提交。";


        // 禁止再次修改
        const checkboxes =
            document.querySelectorAll(
                'input[type="checkbox"]'
            );

        checkboxes.forEach(
            checkbox => checkbox.disabled = true
        );


        submitButton.style.display = "none";


        // 显示结果
        showResults(data.results);


    } catch (error) {

        console.error(error);

        message.textContent =
            "提交失败，请稍后再试。";

        submitButton.disabled = false;
        submitButton.textContent = "提交投票";

    }

});


function showResults(data) {

    results.classList.remove("hidden");

    resultList.innerHTML = "";


    data.forEach(item => {

        const row =
            document.createElement("div");

        row.className = "result";


        row.innerHTML = `
            <div class="result-header">
                <span>${item.option}</span>
                <span>${item.percentage}%</span>
            </div>

            <div class="bar-background">

                <div
                    class="bar"
                    style="width: ${item.percentage}%">
                </div>

            </div>

            <div class="votes">
                ${item.votes} 票
            </div>
        `;


        resultList.appendChild(row);

    });

}
